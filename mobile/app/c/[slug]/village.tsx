import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ApiError, compact, useChannel, useVillage, type VillageItem } from '@loop/shared';
import { VillageView } from '../../../src/Pixel';
import { Avatar, Card, Empty, Loading } from '../../../src/ui';
import { cn } from '../../../src/cn';

function Bar({ p }: { p: number }) {
  return (
    <View className="h-2 rounded-full bg-field overflow-hidden">
      <View className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%` }} />
    </View>
  );
}

function Item({ item, need }: { item: VillageItem; need: number }) {
  return (
    <View className={cn('w-[31%] p-2.5 rounded-md bg-field', !item.unlocked && 'opacity-60')} accessible accessibilityLabel={`${item.name}: ${item.unlocked ? '지었어요' : `벽돌 ${need}개 더`}`}>
      <Text className="text-[13px] font-bold text-fg-strong" numberOfLines={1}>
        {item.unlocked ? '' : '🔒 '}
        {item.name}
        {item.isNew ? ' 🆕' : ''}
      </Text>
      <Text className="mt-0.5 text-[11px] leading-4 text-fg-weak" numberOfLines={2}>
        {item.unlocked ? item.description : `🧱 ${need.toLocaleString()}개 더`}
      </Text>
    </View>
  );
}

/** 채널 마을: 채널 사람들의 활동(벽돌)으로 함께 짓는 도트 마을 */
export default function VillageScreen() {
  const slug = useLocalSearchParams<{ slug: string }>().slug ?? '';
  const channel = useChannel(slug).data;
  const { data: v, error } = useVillage(slug);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: channel ? `${channel.name} 마을` : '마을' });
  }, [navigation, channel]);

  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return <Empty>{error.status === 404 ? '없거나 사라진 채널이에요' : error.message}</Empty>;
  if (!v) return <Loading />;

  const prev = v.items.filter((i) => i.unlocked).reduce((m, i) => Math.max(m, i.bricks), 0);
  return (
    <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
      <Card className="p-3">
        <VillageView village={v} />
        <View className="px-1.5 pt-3.5 pb-1 gap-2">
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-fg-weak">
              Lv.<Text className="text-[17px] font-bold text-fg-strong">{v.level}</Text> / {v.maxLevel}
            </Text>
            <Text className="text-[13px] text-fg-sub">🧱 {v.bricks.toLocaleString()}</Text>
          </View>
          <Text className="text-sm text-fg-sub">
            {v.next ? (
              <>
                다음 건물 <Text className="font-bold text-fg-strong">{v.next.name}</Text>까지 벽돌 <Text className="font-bold text-fg-strong">{v.next.need.toLocaleString()}</Text>개
              </>
            ) : (
              <Text className="font-bold text-fg-strong">🏰 모든 건물을 지었어요!</Text>
            )}
          </Text>
          <Bar p={v.next ? (v.bricks - prev) / Math.max(1, v.next.bricks - prev) : 1} />
        </View>
      </Card>

      <Card className="p-5">
        <Text className="text-base font-bold text-fg-strong">이번 주 공동 목표 {v.festival ? '🎆' : ''}</Text>
        <Text className="mt-1 mb-3 text-[13px] text-fg-weak">
          {v.festival ? '지난주 목표를 넘겨서 이번 주는 마을 축제예요!' : '이번 주에 목표를 넘기면 다음 주 내내 마을에 축제가 열려요.'}
        </Text>
        <View className="flex-row justify-between mb-1.5">
          <Text className="text-[13px] text-fg-sub">
            {v.week.bricks >= v.week.goal ? '🎉 목표 달성! 다음 주는 축제' : `🧱 ${(v.week.goal - v.week.bricks).toLocaleString()}개 남았어요`}
          </Text>
          <Text className="text-[13px] text-fg-sub">
            {v.week.bricks.toLocaleString()} / {v.week.goal.toLocaleString()}
          </Text>
        </View>
        <Bar p={v.week.bricks / v.week.goal} />
      </Card>

      <Card className="p-5">
        <Text className="mb-3 text-base font-bold text-fg-strong">이번 주 마을을 지은 사람</Text>
        {v.contributors.length === 0 ? (
          <Text className="text-[13px] text-fg-weak">아직 없어요. 글이나 댓글로 첫 벽돌을 올려 보세요!</Text>
        ) : (
          v.contributors.map((c, i) => (
            <Pressable key={c.id} onPress={() => router.push(`/u/${c.id}`)} className="flex-row items-center gap-2.5 py-1.5 active:opacity-60">
              <Text className="w-4 text-center text-[13px] font-bold text-fg-weak">{i + 1}</Text>
              <Avatar name={c.nickname} uri={c.avatarUrl} size={26} />
              <Text className="flex-1 text-sm font-semibold text-fg-strong" numberOfLines={1}>
                {c.nickname}
              </Text>
              <Text className="text-[13px] text-fg-weak">🧱 {compact(c.bricks)}</Text>
            </Pressable>
          ))
        )}
      </Card>

      <Card className="p-5">
        <Text className="mb-3 text-base font-bold text-fg-strong">
          건물 <Text className="text-fg-weak">{v.level}/{v.maxLevel}</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {v.items.map((i) => (
            <Item key={i.code} item={i} need={Math.max(0, i.bricks - v.bricks)} />
          ))}
        </View>
      </Card>

      <Card className="p-5">
        <Text className="text-base font-bold text-fg-strong">벽돌 쌓는 법</Text>
        <Text className="mt-1 mb-3 text-[13px] text-fg-weak">채널 사람들의 활동이 모두 벽돌이 돼요. 한 번 지은 건물은 사라지지 않아요.</Text>
        <View className="flex-row flex-wrap gap-2">
          {(
            [
              ['✍️', '글', 10, v.breakdown.posts],
              ['💬', '댓글', 3, v.breakdown.comments],
              ['❤️', '공감 · 반응', 1, v.breakdown.reactions],
              ['👥', '팔로워', 5, v.breakdown.followers],
            ] as const
          ).map(([icon, label, n, count]) => (
            <View key={label} className="w-[48%] items-center rounded-md bg-field py-3">
              <Text className="text-xl">{icon}</Text>
              <Text className="mt-1 text-[13px] font-semibold text-fg-strong">
                {label} = 🧱{n}
              </Text>
              <Text className="text-xs text-fg-weak">지금 {count.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
