import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useFeed, useSignOut } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { Avatar, Button, SectionTitle } from '../../src/ui';

export default function MeScreen() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const feed = useFeed({ authorId: user?.id }, user != null);

  if (!user) {
    return (
      <View className="flex-1 p-6 pt-12 bg-surface">
        <Text className="text-[26px] font-bold leading-9 text-fg-strong">{'로그인하고\n루프를 시작해 보세요'}</Text>
        <Text className="mt-2.5 mb-8 text-[15px] text-fg-sub">글을 쓰고, 좋아요를 누르고, 나만의 채널을 만들 수 있어요.</Text>
        <Button title="로그인" size="lg" full onPress={() => router.push('/login')} />
        <Button title="회원가입" variant="ghost" size="lg" full onPress={() => router.push('/signup')} className="mt-2.5" />
      </View>
    );
  }

  return (
    <PostFeed
      query={feed}
      empty="아직 작성한 글이 없어요"
      header={
        <View className="pt-3">
          <View className="flex-row items-center gap-3.5 p-5 bg-surface">
            <Avatar name={user.nickname} size={56} />
            <View className="flex-1">
              <Text className="text-xl font-bold text-fg-strong">{user.nickname}</Text>
              <Text className="mt-0.5 text-sm text-fg-weak">{user.email}</Text>
            </View>
          </View>
          <View className="flex-row gap-2 px-5 pb-5 bg-surface mb-3">
            <Button title="채널 만들기" variant="secondary" className="flex-1" onPress={() => router.push('/channel-form')} />
            <Button title="로그아웃" variant="ghost" className="flex-1" onPress={signOut} />
          </View>
          <View className="bg-surface">
            <SectionTitle>내가 쓴 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}
