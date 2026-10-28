import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ApiError, compact, useAuth, useChannel, useFeed, useVillage } from '@loop/shared';
import { PostFeed } from '../../../src/PostList';
import { ChannelIcon, Chip, Empty, HeaderIcon, Skeleton } from '../../../src/ui';
import { PopularBlock } from '../../../src/Popular';
import { VillageView } from '../../../src/Pixel';
import { Markdown } from '../../../src/Markdown';

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

export default function ChannelScreen() {
  const params = useLocalSearchParams<{ slug: string; category?: string }>();
  const slug = params.slug;
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();
  const { data: channel, error } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const active = categories.find((c) => String(c.id) === params.category);
  // 잠긴 채널(비공개 · 19세 이상)은 글을 받지 않는다
  const feed = useFeed({ channel: slug, category: active?.id }, !!channel && !channel.locked);
  // 관리자 전용 카테고리에서는 관리자만 글쓰기 버튼을 본다
  const canWrite = !active?.ownerOnly || channel?.mine;

  useLayoutEffect(() => {
    const writeTo = `/write?channel=${slug}${active ? `&category=${active.id}` : ''}`;
    navigation.setOptions({
      title: channel?.name ?? '',
      headerRight: () => (
        <View className="flex-row gap-3">
          {channel?.mine ? <HeaderIcon name="settings-outline" label="채널 관리" onPress={() => router.push(`/c/${slug}/manage`)} /> : null}
          {canWrite ? (
            <HeaderIcon name="create-outline" label="글쓰기" onPress={() => router.push(isLoggedIn ? writeTo : '/login')} />
          ) : null}
        </View>
      ),
    });
  }, [navigation, channel, slug, active, canWrite, isLoggedIn]);

  if (error instanceof ApiError && error.status === 404) return <Empty>없거나 사라진 채널이에요</Empty>;
  if (channel?.locked === 'private') return <Empty>{`🔒 ${channel.name}\n비공개 채널이에요. 받은 초대 링크로 팔로우해 주세요`}</Empty>;
  if (channel?.locked === 'adult') return <Empty>{`${channel.name}\n만 19세 이상만 볼 수 있는 채널이에요. 웹의 설정에서 나이를 확인해 주세요`}</Empty>;

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
                  <ChannelIcon slug={channel.slug} name={channel.name} color={channel.color} size={56} />
                  <View className="flex-1">
                    <Text className="text-[22px] font-bold text-fg-strong">{channel.name}</Text>
                    <Text className="text-sm text-fg-weak">c/{channel.slug}</Text>
                  </View>
                </View>
                {channel.description ? (
                  <View className="mt-3.5 -mb-3.5">
                    <Markdown source={channel.description} />
                  </View>
                ) : null}
                <Text className="mt-2 text-[13px] text-fg-weak">
                  글 {compact(channel.postCount)}개{channel.ownerNickname ? ` · 만든 사람 ${channel.ownerNickname}` : ''}
                </Text>
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
          {!active && channel ? <VillageCard slug={slug} /> : null}
          {!active ? <PopularBlock channel={slug} /> : null}
        </View>
      }
    />
  );
}
