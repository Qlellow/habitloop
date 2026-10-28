import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { BADGE_CATEGORIES, TIER_LABEL, useAuth, useBadgeBook, useFeatureBadge, type BadgeCard, type BadgeCategory } from '@loop/shared';
import { BadgeMark, Button, Chip, Empty, Loading, TIER_RING } from '../src/ui';
import { cn } from '../src/cn';
import { useThemeVars } from '../src/theme';
import { toast } from '../src/Toast';

const earnedOn = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};
const holdersText = (p: number) => (p === 0 ? '아직 아무도 없어요' : p < 1 ? '회원의 1% 미만이 가지고 있어요' : `회원의 ${Math.round(p)}%가 가지고 있어요`);

function Progress({ value, goal }: { value: number; goal: number }) {
  return (
    <View className="h-1.5 rounded-full bg-field overflow-hidden">
      <View className="h-full rounded-full bg-primary" style={{ width: `${Math.min(1, goal ? value / goal : 0) * 100}%` }} />
    </View>
  );
}

/** 도감 한 칸 */
function Cell({ b, featured, onOpen }: { b: BadgeCard; featured: boolean; onOpen: () => void }) {
  const secret = b.hidden && !b.earned;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${b.name}, ${b.earned ? '받음' : '아직 못 받음'}`}
      className={cn('w-[31.5%] items-center gap-1.5 px-1.5 pt-4 pb-3 rounded-lg border bg-surface active:opacity-70', b.earned ? 'border-border' : 'border-line bg-field/40')}
      style={b.earned && b.tier !== 'common' ? { borderColor: `${TIER_RING[b.tier]}88` } : undefined}
    >
      {featured ? <Text className="absolute top-1.5 right-1.5 px-1 rounded-[4px] overflow-hidden bg-primary text-white text-[10px] font-bold">대표</Text> : null}
      <BadgeMark badge={b} size={48} locked={!b.earned} secret={secret} />
      <Text className={cn('text-[13px] font-bold text-center', b.earned ? 'text-fg-strong' : 'text-fg-sub')} numberOfLines={1}>
        {b.name}
      </Text>
      {b.earned ? (
        <Text className="text-[11px] text-fg-weak">
          <Text style={{ color: TIER_RING[b.tier] }} className="font-bold">
            {TIER_LABEL[b.tier]}
          </Text>{' '}
          · {earnedOn(b.earnedAt)}
        </Text>
      ) : b.progress ? (
        <View className="self-stretch px-1 gap-1">
          <Progress value={b.progress[0]} goal={b.progress[1]} />
          <Text className="text-[10px] text-center text-fg-weak">
            {Math.min(b.progress[0], b.progress[1]).toLocaleString()}/{b.progress[1].toLocaleString()}
          </Text>
        </View>
      ) : (
        <Text className="text-[11px] font-semibold text-fg-weak">{secret ? '숨은 배지' : TIER_LABEL[b.tier]}</Text>
      )}
    </Pressable>
  );
}

/** 배지 자세히: 조건 · 진행도 · 가진 사람 비율 · 대표 배지로 달기 */
function Detail({ b, featured, onClose }: { b: BadgeCard; featured: boolean; onClose: () => void }) {
  const feature = useFeatureBadge();
  const themeVars = useThemeVars();
  const secret = b.hidden && !b.earned;
  const set = (code: string | null) =>
    feature.mutate(code, {
      onSuccess: () => {
        toast(code ? `'${b.name}'을 대표 배지로 달았어요` : '대표 배지를 뗐어요');
        onClose();
      },
      onError: (e) => toast(e.message),
    });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" style={themeVars} onPress={onClose} accessibilityLabel="닫기">
        <Pressable className="w-full rounded-[20px] bg-surface px-6 pt-8 pb-6 items-center" onPress={() => undefined}>
          <BadgeMark badge={b} size={96} locked={!b.earned} secret={secret} />
          <Text className="mt-4 text-[13px] font-bold" style={{ color: secret ? undefined : TIER_RING[b.tier] }}>
            {secret ? '숨은 배지' : `${TIER_LABEL[b.tier]} 배지`}
          </Text>
          <Text className="mt-1 text-[21px] font-bold text-fg-strong">{b.name}</Text>
          <Text className="mt-2 text-[15px] leading-[22px] text-center text-fg-sub">{b.description}</Text>
          {!b.earned && b.progress ? (
            <View className="self-stretch mt-5 gap-1.5">
              <View className="flex-row justify-between">
                <Text className="text-[13px] text-fg-weak">진행도</Text>
                <Text className="text-[13px] text-fg-weak">
                  {Math.min(b.progress[0], b.progress[1]).toLocaleString()} / {b.progress[1].toLocaleString()}
                </Text>
              </View>
              <Progress value={b.progress[0]} goal={b.progress[1]} />
            </View>
          ) : null}
          <View className="self-stretch mt-5 rounded-md bg-field px-4 py-3">
            {b.earned ? <Text className="text-[13px] font-semibold text-fg-strong mb-0.5">{earnedOn(b.earnedAt)} 달성</Text> : null}
            <Text className="text-[13px] text-fg-sub">{holdersText(b.holders)}</Text>
          </View>
          {b.earned ? (
            <Button
              className="mt-5"
              full
              title={featured ? '대표 배지 떼기' : '대표 배지로 달기'}
              variant={featured ? 'ghost' : 'primary'}
              loading={feature.isPending}
              onPress={() => set(featured ? null : b.code)}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 내 배지 도감: 종류별로 보고, 받은 배지는 대표 배지로 달 수 있다 */
export default function BadgesScreen() {
  const { isLoggedIn } = useAuth();
  const { data: book, isPending } = useBadgeBook(undefined, isLoggedIn);
  const [cat, setCat] = useState<BadgeCategory | 'all'>('all');
  const [open, setOpen] = useState<string>();
  const list = useMemo(() => (book?.badges ?? []).filter((b) => cat === 'all' || b.category === cat), [book, cat]);

  if (!isLoggedIn) return <Empty>로그인하면 배지 도감을 볼 수 있어요</Empty>;
  if (isPending || !book) return <Loading />;
  const current = book.badges.find((b) => b.code === open);

  return (
    <ScrollView contentContainerClassName="pb-10">
      <View className="bg-surface px-5 pt-5 pb-4 mb-3">
        <Text className="text-[13px] text-fg-weak">모은 배지</Text>
        <Text className="mt-0.5 text-[26px] font-bold text-fg-strong">
          {book.earned}
          <Text className="text-lg text-fg-weak"> / {book.total}</Text>
        </Text>
        <View className="mt-3">
          <Progress value={book.earned} goal={book.total} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pt-4">
          {BADGE_CATEGORIES.map(([k, label]) => (
            <Chip key={k} label={label} selected={cat === k} onPress={() => setCat(k)} />
          ))}
        </ScrollView>
      </View>
      <View className="flex-row flex-wrap gap-2 px-3">
        {list.map((b) => (
          <Cell key={b.code} b={b} featured={book.featured === b.code} onOpen={() => setOpen(b.code)} />
        ))}
      </View>
      {current ? <Detail b={current} featured={book.featured === current.code} onClose={() => setOpen(undefined)} /> : null}
    </ScrollView>
  );
}
