import { useLayoutEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ApiError, compact, useAuth, useChannel, useFeed } from '@loop/shared';
import { PostFeed } from '../../../src/PostList';
import { ChannelIcon, Chip, Empty, HeaderIcon, Skeleton } from '../../../src/ui';
import { makeStyles } from '../../../src/theme';
import { PopularBlock } from '../../../src/Popular';

export default function ChannelScreen() {
  const s = useStyles();
  const params = useLocalSearchParams<{ slug: string; category?: string }>();
  const slug = params.slug;
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();
  const { data: channel, error } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const active = categories.find((c) => String(c.id) === params.category);
  const feed = useFeed({ channel: slug, category: active?.id });
  // 관리자 전용 카테고리에서는 관리자만 글쓰기 버튼을 본다
  const canWrite = !active?.ownerOnly || channel?.mine;

  useLayoutEffect(() => {
    const writeTo = `/write?channel=${slug}${active ? `&category=${active.id}` : ''}`;
    navigation.setOptions({
      title: channel?.name ?? '',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {channel?.mine ? (
            <HeaderIcon name="settings-outline" label="채널 관리" onPress={() => router.push(`/c/${slug}/manage`)} />
          ) : null}
          {canWrite ? (
            <HeaderIcon name="create-outline" label="글쓰기" onPress={() => router.push(isLoggedIn ? writeTo : '/login')} />
          ) : null}
        </View>
      ),
    });
  }, [navigation, channel, slug, active, canWrite, isLoggedIn]);

  if (error instanceof ApiError && error.status === 404) return <Empty>없거나 사라진 채널이에요</Empty>;

  const selectTab = (id?: number) => router.setParams({ category: id ? String(id) : undefined });

  return (
    <PostFeed
      query={feed}
      badge="category"
      empty={active ? `'${active.name}'에 아직 글이 없어요` : '이 채널의 첫 글을 남겨 보세요!'}
      header={
        <View>
          <View style={s.hero}>
            {channel ? (
              <>
                <View style={s.heroTop}>
                  <ChannelIcon slug={channel.slug} name={channel.name} size={56} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{channel.name}</Text>
                    <Text style={s.slug}>c/{channel.slug}</Text>
                  </View>
                </View>
                {channel.description ? <Text style={s.desc}>{channel.description}</Text> : null}
                <Text style={s.meta}>
                  글 {compact(channel.postCount)}개{channel.ownerNickname ? ` · 만든 사람 ${channel.ownerNickname}` : ''}
                </Text>
              </>
            ) : (
              <View style={s.heroTop}>
                <Skeleton width={56} height={56} />
                <Skeleton width={140} height={24} />
              </View>
            )}
            {categories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
                <Chip label="전체" selected={!active} onPress={() => selectTab()} />
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} selected={active?.id === c.id} onPress={() => selectTab(c.id)} />
                ))}
              </ScrollView>
            ) : null}
          </View>
          {!active ? <PopularBlock channel={slug} /> : null}
        </View>
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  hero: { backgroundColor: c.surface, padding: 20, paddingBottom: 16, marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 22, fontWeight: '700', color: c.textStrong },
  slug: { fontSize: 14, color: c.weak },
  desc: { marginTop: 14, fontSize: 15, lineHeight: 22, color: c.sub },
  meta: { marginTop: 8, fontSize: 13, color: c.weak },
  tabs: { gap: 8, paddingTop: 16 },
}));
