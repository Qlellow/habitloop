import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { compact, usePopular } from '@loop/shared';
import { SectionTitle } from './ui';
import { makeStyles } from './theme';

/** 인기글 5개 (전체 또는 채널별) */
export function PopularBlock({ channel }: { channel?: string }) {
  const s = useStyles();
  const { data } = usePopular(channel);
  if (!data?.length) return null;
  return (
    <View style={s.block}>
      <SectionTitle>지금 인기 있는 글</SectionTitle>
      {data.map((p, i) => (
        <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={({ pressed }) => [s.rank, pressed && s.pressed]}>
          <Text style={s.rankNo}>{i + 1}</Text>
          <Text style={s.rankTitle} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={s.rankLikes}>♥ {compact(p.likeCount)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  block: { backgroundColor: c.surface, marginBottom: 12, paddingBottom: 12 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 11 },
  pressed: { backgroundColor: c.pressed },
  rankNo: { width: 18, fontSize: 16, fontWeight: '700', color: c.primary, textAlign: 'center' },
  rankTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: c.textStrong },
  rankLikes: { fontSize: 13, color: c.weak },
}));
