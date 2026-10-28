import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, useMyInvite, usePointLogs, type PointLog, type PointLogFilter } from '@loop/shared';
import { Button, Card, Chip, Empty, Loading } from '../src/ui';
import { cn } from '../src/cn';
import { useColors, useThemeVars } from '../src/theme';

/** 포인트 모으는 법 (API 의 RewardsService 와 같은 값) */
const POINT_RULES = [
  ['매일 출석', '+10P · 7일 연속마다 +50P'],
  ['글 쓰기', '+5P · 하루 5번까지'],
  ['내 글이 공감 받기', '공감 하나에 +2P'],
  ['친구 초대', '친구가 가입하면 +100P (친구도 +30P)'],
] as const;

const ORDER_LABEL: Record<PointLogFilter['order'], string> = { latest: '최신순', oldest: '오래된순' };

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

/** 내역 한 줄: 내용 · 날짜 · 포인트 */
function LogRow({ log }: { log: PointLog }) {
  return (
    <View className="flex-row items-center gap-3 px-5 py-3 border-b border-line">
      <View className="flex-1">
        <Text className="text-[15px] text-fg-strong">{log.reason}</Text>
        <Text className="mt-0.5 text-xs text-fg-weak">{dateTime(log.createdAt)}</Text>
      </View>
      <Text className={cn('text-[15px] font-bold', log.delta > 0 ? 'text-primary' : 'text-danger')}>
        {log.delta > 0 ? '+' : ''}
        {log.delta.toLocaleString()}P
      </Text>
    </View>
  );
}

/** 포인트 내역 전체 (창): 종류(전체/적립/사용) · 정렬(최신순/오래된순), 아래로 내리면 더 받는다 */
function LogsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const themeVars = useThemeVars();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<PointLogFilter>({ order: 'latest' });
  const logs = usePointLogs(filter, visible);
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Modal 은 루트 밖에 그려지므로 색 변수를 여기서 다시 건다 */}
      <View className="flex-1 bg-surface" style={[themeVars, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <Text className="flex-1 text-lg font-bold text-fg-strong">포인트 내역</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="닫기">
            <Ionicons name="close" size={24} color={c.textStrong} />
          </Pressable>
        </View>
        <View className="flex-row items-center gap-2 px-5 pb-3 border-b border-line">
          {TYPES.map(([t, label]) => (
            <Chip key={label} label={label} selected={filter.type === t} onPress={() => setFilter((f) => ({ ...f, type: t }))} />
          ))}
          {/* 정렬은 눌러서 최신순 ↔ 오래된순 */}
          <Pressable
            onPress={() => setFilter((f) => ({ ...f, order: f.order === 'latest' ? 'oldest' : 'latest' }))}
            accessibilityRole="button"
            accessibilityLabel={`정렬: ${ORDER_LABEL[filter.order]} (눌러서 바꾸기)`}
            hitSlop={8}
            className="ml-auto flex-row items-center gap-1"
          >
            <Ionicons name="swap-vertical" size={15} color={c.sub} />
            <Text className="text-sm font-semibold text-fg-sub">{ORDER_LABEL[filter.order]}</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(l) => String(l.id)}
          renderItem={({ item }) => <LogRow log={item} />}
          ListEmptyComponent={
            logs.isPending ? (
              <Loading />
            ) : (
              <Empty>{filter.type === 'earn' ? '적립한 포인트가 없어요' : filter.type === 'spend' ? '사용한 포인트가 없어요' : '아직 포인트 내역이 없어요'}</Empty>
            )
          }
          ListFooterComponent={logs.isFetchingNextPage ? <Loading /> : <View className="h-6" />}
          onEndReached={() => logs.hasNextPage && !logs.isFetchingNextPage && logs.fetchNextPage()}
          onEndReachedThreshold={0.5}
        />
      </View>
    </Modal>
  );
}

const RECENT = 5;

/** 포인트: 가진 포인트 · 모으는 법 · 친구 초대 · 최근 내역 (전체 내역은 창으로) */
export default function PointsScreen() {
  const { user } = useAuth();
  const invite = useMyInvite(!!user);
  const recent = usePointLogs({ order: 'latest' }, !!user);
  const [showAll, setShowAll] = useState(false);
  if (!user) return <Empty>로그인하면 포인트를 모을 수 있어요</Empty>;
  const items = recent.data?.pages[0]?.items ?? [];
  const code = invite.data?.code;

  return (
    <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
      <Card className="p-5">
        <Text className="text-[13px] font-semibold text-fg-sub">가진 포인트</Text>
        <Text className="mt-1 text-[32px] font-extrabold text-fg-strong">{(user.points ?? 0).toLocaleString()}P</Text>
      </Card>
      <Card>
        <View className="flex-row items-center px-5 pt-5 pb-2">
          <Text className="flex-1 text-base font-bold text-fg-strong">최근 포인트 내역</Text>
          {items.length > 0 ? (
            <Text className="text-sm font-semibold text-primary" onPress={() => setShowAll(true)} accessibilityRole="button">
              전체 보기 ›
            </Text>
          ) : null}
        </View>
        {recent.isPending ? (
          <Loading />
        ) : items.length === 0 ? (
          <Text className="px-5 pb-5 text-sm text-fg-weak">아직 포인트 내역이 없어요</Text>
        ) : (
          <>
            {items.slice(0, RECENT).map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
            {items.length > RECENT || recent.hasNextPage ? (
              <Pressable onPress={() => setShowAll(true)} className="py-3.5 items-center active:bg-pressed" accessibilityRole="button">
                <Text className="text-sm font-semibold text-fg-sub">내역 전체 보기</Text>
              </Pressable>
            ) : (
              <View className="h-2" />
            )}
          </>
        )}
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
      <LogsModal visible={showAll} onClose={() => setShowAll(false)} />
    </ScrollView>
  );
}
