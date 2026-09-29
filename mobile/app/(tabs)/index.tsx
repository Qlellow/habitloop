import { ScrollView, Pressable, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { compact, useAuth, useChannels, useFeed } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { PopularBlock } from '../../src/Popular';
import { ChannelIcon, HeaderIcon, SectionTitle } from '../../src/ui';

function ChannelRail() {
  const { data } = useChannels();
  if (!data?.length) return null;
  return (
    <View className="bg-surface mb-3 pb-3">
      <SectionTitle
        right={
          <Text className="text-sm text-fg-sub font-medium" onPress={() => router.navigate('/channels')}>
            전체 보기
          </Text>
        }
      >
        인기 채널
      </SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 gap-2.5">
        {data.slice(0, 10).map((c) => (
          <Pressable
            key={c.slug}
            onPress={() => router.push(`/c/${c.slug}`)}
            className="w-[120px] p-3.5 rounded-md bg-field gap-1 active:opacity-70"
          >
            <ChannelIcon slug={c.slug} name={c.name} />
            <Text className="mt-2 text-[15px] font-bold text-fg-strong" numberOfLines={1}>
              {c.name}
            </Text>
            <Text className="text-xs text-fg-weak">글 {compact(c.postCount)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const feed = useFeed({});
  const { isLoggedIn } = useAuth();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row gap-2.5 mr-3">
          <HeaderIcon name="search" label="검색" onPress={() => router.push('/search')} />
          <HeaderIcon name="create-outline" label="글쓰기" onPress={() => router.push(isLoggedIn ? '/write' : '/login')} />
        </View>
      ),
    });
  }, [navigation, isLoggedIn]);

  return (
    <PostFeed
      query={feed}
      empty="아직 글이 없어요. 첫 글을 남겨 보세요!"
      header={
        <View className="bg-bg pt-3">
          <ChannelRail />
          <PopularBlock />
          <View className="bg-surface pb-3">
            <SectionTitle>전체 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}
