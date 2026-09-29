import { ScrollView, Pressable, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { compact, useAuth, useChannels, useFeed } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { PopularBlock } from '../../src/Popular';
import { ChannelIcon, HeaderIcon, SectionTitle } from '../../src/ui';
import { makeStyles } from '../../src/theme';

function ChannelRail() {
  const s = useStyles();
  const { data } = useChannels();
  if (!data?.length) return null;
  return (
    <View style={s.block}>
      <SectionTitle
        right={
          <Text style={s.more} onPress={() => router.navigate('/channels')}>
            전체 보기
          </Text>
        }
      >
        인기 채널
      </SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {data.slice(0, 10).map((c) => (
          <Pressable
            key={c.slug}
            onPress={() => router.push(`/c/${c.slug}`)}
            style={({ pressed }) => [s.railCard, pressed && { opacity: 0.7 }]}
          >
            <ChannelIcon slug={c.slug} name={c.name} />
            <Text style={s.railName} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={s.railMeta}>글 {compact(c.postCount)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const s = useStyles();
  const feed = useFeed({});
  const { isLoggedIn } = useAuth();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 10, marginRight: 12 }}>
          <HeaderIcon name="search" label="검색" onPress={() => router.push('/search')} />
          <HeaderIcon
            name="create-outline"
            label="글쓰기"
            onPress={() => router.push(isLoggedIn ? '/write' : '/login')}
          />
        </View>
      ),
    });
  }, [navigation, isLoggedIn]);

  return (
    <PostFeed
      query={feed}
      empty="아직 글이 없어요. 첫 글을 남겨 보세요!"
      header={
        <View style={s.header}>
          <ChannelRail />
          <PopularBlock />
          <View style={[s.block, { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            <SectionTitle>전체 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  header: { backgroundColor: c.bg, paddingTop: 12 },
  block: { backgroundColor: c.surface, marginBottom: 12, paddingBottom: 12 },
  more: { fontSize: 14, color: c.sub, fontWeight: '500' },
  rail: { paddingHorizontal: 16, gap: 10 },
  railCard: { width: 120, padding: 14, borderRadius: 14, backgroundColor: c.field, gap: 4 },
  railName: { marginTop: 8, fontSize: 15, fontWeight: '700', color: c.textStrong },
  railMeta: { fontSize: 12, color: c.weak },
}));
