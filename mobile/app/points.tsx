import { useState } from 'react';
import { FlatList, Share, Text, View } from 'react-native';
import { useAuth, useMyInvite, usePointLogs, type PointLogFilter } from '@loop/shared';
import { Button, Card, Chip, Empty, Loading } from '../src/ui';
import { cn } from '../src/cn';

/** 포인트 모으는 법 (API 의 RewardsService 와 같은 값) */
const POINT_RULES = [
  ['매일 출석', '+10P · 7일 연속마다 +50P'],
  ['글 쓰기', '+5P · 하루 5번까지'],
  ['내 글이 공감 받기', '공감 하나에 +2P'],
  ['친구 초대', '친구가 가입하면 +100P (친구도 +30P)'],
] as const;

const TYPES: [PointLogFilter['type'], string][] = [
  [undefined, '전체'],
  ['earn', '적립'],
  ['spend', '사용'],
];

const dateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 포인트: 가진 포인트 · 모으는 법 · 친구 초대 · 내역 */
export default function PointsScreen() {
  const { user } = useAuth();
  const invite = useMyInvite(!!user);
  const [filter, setFilter] = useState<PointLogFilter>({ order: 'latest' });
  const logs = usePointLogs(filter, !!user);
  if (!user) return <Empty>로그인하면 포인트를 모을 수 있어요</Empty>;
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  const code = invite.data?.code;

  return (
    <FlatList
      data={items}
      keyExtractor={(l) => String(l.id)}
      ListHeaderComponent={
        <View className="p-4 gap-3">
          <Card className="p-5">
            <Text className="text-[13px] font-semibold text-fg-sub">가진 포인트</Text>
            <Text className="mt-1 text-[32px] font-extrabold text-fg-strong">{(user.points ?? 0).toLocaleString()}P</Text>
          </Card>
          <Card className="p-5">
            <Text className="text-base font-bold text-fg-strong">포인트 모으기</Text>
            <Text className="mt-1 mb-3 text-[13px] text-fg-weak">모은 포인트로 커스텀 배너 같은 꾸미기를 열 수 있어요.</Text>
            <View className="gap-1.5">
              {POINT_RULES.map(([what, how]) => (
                <View key={what} className="flex-row justify-between gap-3 px-3 py-2.5 rounded-md bg-field">
                  <Text className="text-sm text-fg">{what}</Text>
                  <Text className="shrink text-right text-[13px] font-semibold text-primary">{how}</Text>
                </View>
              ))}
            </View>
          </Card>
          <Card className="p-5">
            <Text className="text-base font-bold text-fg-strong">친구 초대</Text>
            <Text className="mt-1 mb-3 text-[13px] text-fg-weak">내 초대 코드로 친구가 가입하면 나는 +100P, 친구는 +30P 를 받아요.</Text>
            <View className="flex-row items-center gap-2">
              <Text selectable className="flex-1 px-4 py-3 rounded-md bg-field text-base font-bold tracking-widest text-fg-strong">
                {code ?? '…'}
              </Text>
              <Button
                title="공유하기"
                disabled={!code}
                onPress={() => Share.share({ message: `${user.nickname}님이 루프에 초대했어요. 가입할 때 초대 코드 ${code} 를 넣으면 30P 를 받아요!` })}
              />
            </View>
            {invite.data ? <Text className="mt-2 text-[13px] text-fg-weak">지금까지 {invite.data.invitedCount.toLocaleString()}명을 초대했어요.</Text> : null}
          </Card>
          <View className="flex-row items-center gap-2 pt-2">
            <Text className="mr-auto text-lg font-bold text-fg-strong">포인트 내역</Text>
            {TYPES.map(([t, label]) => (
              <Chip key={label} label={label} selected={filter.type === t} onPress={() => setFilter((f) => ({ ...f, type: t }))} />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 mx-4 px-4 py-3 bg-surface border-b border-line">
          <View className="flex-1">
            <Text className="text-[15px] text-fg-strong">{item.reason}</Text>
            <Text className="mt-0.5 text-xs text-fg-weak">{dateTime(item.createdAt)}</Text>
          </View>
          <Text className={cn('text-[15px] font-bold', item.delta > 0 ? 'text-primary' : 'text-danger')}>
            {item.delta > 0 ? '+' : ''}
            {item.delta.toLocaleString()}P
          </Text>
        </View>
      )}
      ListEmptyComponent={
        logs.isPending ? (
          <Loading />
        ) : (
          <Empty>{filter.type === 'earn' ? '적립한 포인트가 없어요' : filter.type === 'spend' ? '사용한 포인트가 없어요' : '아직 포인트 내역이 없어요'}</Empty>
        )
      }
      ListFooterComponent={logs.isFetchingNextPage ? <Loading /> : <View className="h-10" />}
      onEndReached={() => logs.hasNextPage && !logs.isFetchingNextPage && logs.fetchNextPage()}
      onEndReachedThreshold={0.5}
    />
  );
}
