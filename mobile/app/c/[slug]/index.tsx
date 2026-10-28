import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ApiError, compact, useAuth, useBookmark, useChannel, useFeed, useMembership, useNotices, useVillage, type ChannelDetail } from '@loop/shared';
import { PostFeed, PostRow } from '../../../src/PostList';
import { Button, ChannelIcon, Chip, Empty, HeaderIcon, Input, Skeleton } from '../../../src/ui';
import { PopularBlock } from '../../../src/Popular';
import { VillageView } from '../../../src/Pixel';
import { Markdown } from '../../../src/Markdown';
import { useColors } from '../../../src/theme';
import { toast } from '../../../src/Toast';

/** 채널 마을 미리보기: 누르면 마을로 */
function VillageCard({ slug }: { slug: string }) {
  const { data: v } = useVillage(slug);
  if (!v) return null;
  return (
    <Pressable onPress={() => router.push(`/c/${slug}/village`)} accessibilityRole="button" className="bg-surface px-5 py-4 mb-3 active:opacity-80">
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-[17px] font-bold text-fg-strong">
          채널 마을 <Text className="text-sm text-primary">Lv.{v.level}</Text> {v.festival ? '🎆' : ''}
        </Text>
        <Text className="text-[13px] text-fg-weak">🧱 {v.bricks.toLocaleString()} ›</Text>
      </View>
      <VillageView village={v} />
    </Pressable>
  );
}

/** 팔로우 · 팔로우 취소 (글쓰기는 팔로우한 사람만) */
function JoinButton({ channel }: { channel: ChannelDetail }) {
  const { isLoggedIn } = useAuth();
  const join = useMembership(channel.slug);
  if (!isLoggedIn) return <Button title="팔로우" size="sm" onPress={() => router.push('/login')} />;
  if (channel.joined) {
    return (
      <Button
        title={channel.mine ? '내가 만든 채널' : '팔로잉'}
        variant="ghost"
        size="sm"
        loading={join.isPending}
        // 소유자는 채널을 떠날 수 없다
        disabled={channel.mine}
        onPress={() =>
          Alert.alert(`${channel.name} 채널 팔로우를 취소할까요?`, '취소하면 이 채널에 글을 쓸 수 없어요.', [
            { text: '닫기', style: 'cancel' },
            { text: '팔로우 취소', style: 'destructive', onPress: () => join.mutate(false, { onError: (e) => toast(e.message) }) },
          ])
        }
      />
    );
  }
  return (
    <Button
      title="팔로우"
      size="sm"
      loading={join.isPending}
      onPress={() => join.mutate(true, { onSuccess: () => toast(`${channel.name} 채널을 팔로우했어요`), onError: (e) => toast(e.message) })}
    />
  );
}

/** 북마크 (팔로우와 별개로 채널 목록 맨 위에 둔다) */
function BookmarkButton({ channel }: { channel: ChannelDetail }) {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const bookmark = useBookmark(channel.slug);
  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={channel.bookmarked ? '북마크 해제' : '북마크'}
      accessibilityState={{ selected: channel.bookmarked }}
      onPress={() => (isLoggedIn ? bookmark.mutate(!channel.bookmarked, { onError: (e) => toast(e.message) }) : router.push('/login'))}
      className="w-[34px] h-[34px] items-center justify-center rounded-sm bg-field"
    >
      <Ionicons name={channel.bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={channel.bookmarked ? c.primary : c.sub} />
    </Pressable>
  );
}

/** 볼 수 없는 채널: 비공개(초대 코드로 팔로우) · 19세 이상 */
function LockedGate({ channel }: { channel: ChannelDetail }) {
  const { isLoggedIn } = useAuth();
  const join = useMembership(channel.slug);
  const [code, setCode] = useState('');
  return (
    <View className="flex-1 bg-surface p-6 pt-10 items-center">
      <ChannelIcon slug={channel.slug} name={channel.name} color={channel.color} iconVersion={channel.iconVersion} size={64} />
      <Text className="mt-3 text-xl font-bold text-fg-strong">{channel.name}</Text>
      {channel.locked === 'adult' ? (
        <Text className="mt-2 text-center text-[15px] leading-[22px] text-fg-sub">
          {'만 19세 이상만 볼 수 있는 채널이에요.\n웹의 설정에서 나이를 확인해 주세요.'}
        </Text>
      ) : (
        <>
          <Text className="mt-2 mb-6 text-center text-[15px] leading-[22px] text-fg-sub">초대받은 사람만 볼 수 있어요. 받은 초대 코드를 입력해 주세요.</Text>
          {isLoggedIn ? (
            <View className="self-stretch gap-2.5">
              <Input value={code} onChangeText={setCode} placeholder="초대 코드" autoCapitalize="characters" autoCorrect={false} />
              <Button
                title="팔로우"
                full
                disabled={!code.trim()}
                loading={join.isPending}
                onPress={() => join.mutate({ code: code.trim() }, { onSuccess: () => toast(`${channel.name} 채널을 팔로우했어요`), onError: (e) => toast(e.message) })}
              />
            </View>
          ) : (
            <Button title="로그인하고 초대 코드 입력하기" onPress={() => router.push('/login')} />
          )}
        </>
      )}
    </View>
  );
}

/** 채널 소개: 길면 접어 두고 '더 보기' */
function Intro({ source }: { source: string }) {
  const [open, setOpen] = useState(false);
  const [tall, setTall] = useState(false);
  return (
    <View className="mt-3.5">
      <View style={open ? undefined : { maxHeight: 132, overflow: 'hidden' }} onLayout={(e) => !open && setTall(e.nativeEvent.layout.height >= 130)}>
        <View className="-mb-3.5">
          <Markdown source={source} />
        </View>
        {/* 접혀 있을 때 아래쪽을 흐리게: 잘린 줄이 반쯤 보이지 않게 */}
        {tall && !open ? (
          <View pointerEvents="none" className="absolute left-0 right-0 bottom-0">
            {[0.35, 0.6, 0.8, 0.95].map((o) => (
              <View key={o} className="h-2 bg-surface" style={{ opacity: o }} />
            ))}
          </View>
        ) : null}
      </View>
      {tall ? (
        <Text className="mt-1 text-sm font-semibold text-fg-sub" onPress={() => setOpen((v) => !v)} accessibilityRole="button">
          {open ? '접기' : '더 보기'}
        </Text>
      ) : null}
    </View>
  );
}

/** 운영진 전용 카테고리 글(공지): 전체 탭 위에 고정 */
function PinnedNotices({ slug }: { slug: string }) {
  const { data } = useNotices(slug);
  if (!data?.length) return null;
  return (
    <View className="bg-surface mb-3">
      <Text className="px-5 pt-4 pb-1 text-[13px] font-bold text-primary">📌 공지</Text>
      {data.slice(0, 3).map((p) => (
        <PostRow key={p.id} post={p} badge="category" />
      ))}
    </View>
  );
}

export default function ChannelScreen() {
  const params = useLocalSearchParams<{ slug: string; category?: string }>();
  const slug = params.slug;
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();
  const { data: channel, error, isPlaceholderData } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const active = categories.find((c) => String(c.id) === params.category);
  // 잠긴 채널(비공개 · 19세 이상)은 글을 받지 않는다
  const feed = useFeed({ channel: slug, category: active?.id }, !!channel && !channel.locked);
  // 글쓰기는 팔로우한 사람만, 운영진 전용 카테고리 탭에서는 운영진만
  const canWrite = !!channel?.joined && (!active?.ownerOnly || channel.staff);

  useLayoutEffect(() => {
    const writeTo = `/write?channel=${slug}${active ? `&category=${active.id}` : ''}`;
    navigation.setOptions({
      title: channel?.name ?? '',
      headerRight: () => (
        <View className="flex-row gap-3">
          {channel?.staff ? (
            <HeaderIcon
              name="flag-outline"
              label={channel.reportCount ? `신고함 ${channel.reportCount}건` : '신고함'}
              dot={!!channel.reportCount}
              onPress={() => router.push(`/c/${slug}/reports`)}
            />
          ) : null}
          {channel?.canManage ? <HeaderIcon name="settings-outline" label="채널 관리" onPress={() => router.push(`/c/${slug}/manage`)} /> : null}
          {canWrite && isLoggedIn ? <HeaderIcon name="create-outline" label="글쓰기" onPress={() => router.push(writeTo)} /> : null}
        </View>
      ),
    });
  }, [navigation, channel, slug, active, canWrite, isLoggedIn]);

  if (error instanceof ApiError && error.status === 404) return <Empty>없거나 사라진 채널이에요</Empty>;
  if (channel?.locked && !isPlaceholderData) return <LockedGate channel={channel} />;

  const selectTab = (id?: number) => router.setParams({ category: id ? String(id) : undefined });

  return (
    <PostFeed
      query={feed}
      badge="category"
      empty={active ? `'${active.name}'에 아직 글이 없어요` : '이 채널의 첫 글을 남겨 보세요!'}
      header={
        <View>
          <View className="bg-surface p-5 pb-4 mb-3">
            {channel ? (
              <>
                <View className="flex-row items-center gap-3.5">
                  <ChannelIcon slug={channel.slug} name={channel.name} color={channel.color} iconVersion={channel.iconVersion} size={56} />
                  <View className="flex-1">
                    <Text className="text-[22px] font-bold text-fg-strong" numberOfLines={1}>
                      {channel.name}
                      {channel.visibility === 'private' ? ' 🔒' : ''}
                      {channel.adult ? ' 🔞' : ''}
                    </Text>
                    <Text className="text-[13px] text-fg-weak">
                      팔로워 {compact(channel.memberCount)}명 · 글 {compact(channel.postCount)}개
                    </Text>
                  </View>
                </View>
                {!isPlaceholderData ? (
                  <View className="flex-row items-center gap-2 mt-3.5">
                    <View className="flex-1">
                      <JoinButton channel={channel} />
                    </View>
                    <BookmarkButton channel={channel} />
                  </View>
                ) : null}
                {channel.description ? <Intro key={channel.slug} source={channel.description} /> : null}
              </>
            ) : (
              <View className="flex-row items-center gap-3.5">
                <Skeleton width={56} height={56} />
                <Skeleton width={140} height={24} />
              </View>
            )}
            {categories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pt-4">
                <Chip label="전체" selected={!active} onPress={() => selectTab()} />
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} selected={active?.id === c.id} onPress={() => selectTab(c.id)} />
                ))}
              </ScrollView>
            ) : null}
          </View>
          {!active ? <PinnedNotices slug={slug} /> : null}
          {!active && channel ? <VillageCard slug={slug} /> : null}
          {!active ? <PopularBlock channel={slug} /> : null}
        </View>
      }
    />
  );
}
