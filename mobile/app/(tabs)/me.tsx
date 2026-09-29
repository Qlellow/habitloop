import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useFeed, useSignOut } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { Avatar, Button, SectionTitle } from '../../src/ui';
import { makeStyles } from '../../src/theme';

export default function MeScreen() {
  const s = useStyles();
  const { user } = useAuth();
  const signOut = useSignOut();
  const feed = useFeed({ authorId: user?.id }, user != null);

  if (!user) {
    return (
      <View style={s.guest}>
        <Text style={s.guestTitle}>{'로그인하고\n루프를 시작해 보세요'}</Text>
        <Text style={s.guestDesc}>글을 쓰고, 좋아요를 누르고, 나만의 채널을 만들 수 있어요.</Text>
        <Button title="로그인" size="lg" full onPress={() => router.push('/login')} />
        <Button title="회원가입" variant="ghost" size="lg" full onPress={() => router.push('/signup')} style={{ marginTop: 10 }} />
      </View>
    );
  }

  return (
    <PostFeed
      query={feed}
      empty="아직 작성한 글이 없어요"
      header={
        <View style={{ paddingTop: 12 }}>
          <View style={s.profile}>
            <Avatar name={user.nickname} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{user.nickname}</Text>
              <Text style={s.email}>{user.email}</Text>
            </View>
          </View>
          <View style={s.actions}>
            <Button title="채널 만들기" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/channel-form')} />
            <Button title="로그아웃" variant="ghost" style={{ flex: 1 }} onPress={signOut} />
          </View>
          <View style={s.sectionHead}>
            <SectionTitle>내가 쓴 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  guest: { flex: 1, padding: 24, paddingTop: 48, backgroundColor: c.surface },
  guestTitle: { fontSize: 26, fontWeight: '700', lineHeight: 36, color: c.textStrong },
  guestDesc: { marginTop: 10, marginBottom: 32, fontSize: 15, color: c.sub },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, backgroundColor: c.surface },
  name: { fontSize: 20, fontWeight: '700', color: c.textStrong },
  email: { marginTop: 2, fontSize: 14, color: c.weak },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: c.surface, marginBottom: 12 },
  sectionHead: { backgroundColor: c.surface },
}));
