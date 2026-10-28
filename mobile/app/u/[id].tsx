import { useLayoutEffect } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ApiError, PET_SPECIES, PET_STAGES, compact, isUserId, useAuth, useBlockUser, useFeed, useUserProfile, type UserProfile } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { PetView } from '../../src/Pixel';
import { Avatar, BadgeMark, Button, Empty, SectionTitle, Skeleton } from '../../src/ui';

const joinedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월에 가입`;
};

function BlockButton({ user }: { user: UserProfile }) {
  const block = useBlockUser();
  const toggle = () =>
    user.blocked
      ? block.mutate({ userId: user.id, block: false })
      : Alert.alert(`${user.nickname}님을 차단할까요?`, '이 사람의 글과 댓글이 가려지고, 나에게 알림을 보낼 수 없어요.', [
          { text: '취소', style: 'cancel' },
          { text: '차단', style: 'destructive', onPress: () => block.mutate({ userId: user.id, block: true }, { onError: (e) => Alert.alert(e.message) }) },
        ]);
  return <Button title={user.blocked ? '차단 해제' : '차단'} variant={user.blocked ? 'ghost' : 'danger'} size="sm" loading={block.isPending} onPress={toggle} />;
}

function Header({ user }: { user?: UserProfile }) {
  const { user: me } = useAuth();
  if (!user) {
    return (
      <View className="flex-row items-center gap-4 p-5 bg-surface mb-3">
        <Skeleton width={64} height={64} className="rounded-full" />
        <Skeleton width={140} height={22} />
      </View>
    );
  }
  return (
    <View className="bg-surface mb-3">
      <View className="flex-row items-center gap-4 p-5">
        <Avatar name={user.nickname} uri={user.avatarUrl} size={64} />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="shrink text-xl font-bold text-fg-strong" numberOfLines={1}>
              {user.nickname}
            </Text>
            <BadgeMark badge={user.featuredBadge} size={22} />
          </View>
          <Text className="mt-1 text-sm text-fg-sub">
            글 {compact(user.postCount)} · 댓글 {compact(user.commentCount)}
          </Text>
          <Text className="mt-0.5 text-[13px] text-fg-weak">{joinedAt(user.createdAt)}</Text>
        </View>
        {me && me.id !== user.id ? <BlockButton user={user} /> : null}
      </View>
      {user.pet ? (
        <View className="flex-row items-center gap-4 mx-5 mb-4 p-3 rounded-lg bg-field">
          <View className="w-[80px] h-[80px] items-center justify-end">
            <PetView pet={user.pet} size={4} />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] text-fg-weak">{user.nickname}의 펫</Text>
            <Text className="text-base font-bold text-fg-strong" numberOfLines={1}>
              {user.pet.name} <Text className="text-sm text-primary">Lv.{user.pet.level}</Text>
            </Text>
            <Text className="text-sm text-fg-sub">
              {PET_SPECIES.find((p) => p.species === user.pet!.species)?.label} · {PET_STAGES[user.pet.stage].label}
            </Text>
          </View>
        </View>
      ) : null}
      {user.badges?.length ? (
        <View className="pb-4">
          <Text className="px-5 pb-2 text-[13px] font-semibold text-fg-weak">받은 배지 {user.badges.length}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 gap-3">
            {user.badges.map((b) => (
              <View key={b.code} className="w-[68px] items-center gap-1.5" accessible accessibilityLabel={`${b.name}: ${b.description}`}>
                <BadgeMark badge={b} size={44} />
                <Text className="text-xs text-center text-fg-sub" numberOfLines={2}>
                  {b.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** 사용자 프로필: 닉네임 · 대표 배지 · 받은 배지 · 쓴 글 */
export default function UserScreen() {
  const id = useLocalSearchParams<{ id: string }>().id ?? '';
  const profile = useUserProfile(id);
  const feed = useFeed({ authorId: id }, isUserId(id));
  const navigation = useNavigation();
  const user = profile.data;

  useLayoutEffect(() => {
    navigation.setOptions({ title: user?.nickname ?? '' });
  }, [navigation, user?.nickname]);

  if (!isUserId(id) || (profile.error instanceof ApiError && profile.error.status === 404)) {
    return <Empty>없는 사용자예요</Empty>;
  }

  return (
    <PostFeed
      query={feed}
      empty={user?.blocked ? '차단한 사용자의 글은 보이지 않아요' : '아직 쓴 글이 없어요'}
      header={
        <View className="pt-3 bg-bg">
          <Header user={user} />
          <View className="bg-surface">
            <SectionTitle>쓴 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}
