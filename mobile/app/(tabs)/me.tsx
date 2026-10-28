import { Alert, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useAuth, useFeed, useSignOut } from '@loop/shared';
import { PostFeed } from '../../src/PostList';
import { Avatar, Button, SectionTitle } from '../../src/ui';
import { useColors } from '../../src/theme';

const MENU: [keyof typeof Ionicons.glyphMap, string, Href][] = [
  ['ribbon-outline', '배지 도감', '/badges'],
  ['paw-outline', '내 펫', '/pet'],
  ['boat-outline', '메시지 표류병', '/sea'],
  ['wallet-outline', '포인트', '/points'],
  ['megaphone-outline', '공지사항', '/notices'],
  ['settings-outline', '설정', '/settings'],
];

export default function MeScreen() {
  const { user } = useAuth();
  const c = useColors();
  const signOut = useSignOut();
  const feed = useFeed({ authorId: user?.id }, user != null);

  if (!user) {
    return (
      <View className="flex-1 p-6 pt-12 bg-surface">
        <Text className="text-[26px] font-bold leading-9 text-fg-strong">{'로그인하고\n루프를 시작해 보세요'}</Text>
        <Text className="mt-2.5 mb-8 text-[15px] text-fg-sub">글을 쓰고, 좋아요를 누르고, 나만의 채널을 만들 수 있어요.</Text>
        <Button title="로그인" size="lg" full onPress={() => router.push('/login')} />
        <Button title="회원가입" variant="ghost" size="lg" full onPress={() => router.push('/signup')} className="mt-2.5" />
        <Button title="공지사항" variant="text" full onPress={() => router.push('/notices')} className="mt-6" />
        <Button title="화면 설정" variant="text" full onPress={() => router.push('/settings')} />
      </View>
    );
  }

  return (
    <PostFeed
      query={feed}
      empty="아직 작성한 글이 없어요"
      header={
        <View className="pt-3">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="내 프로필 보기"
            onPress={() => router.push(`/u/${user.id}`)}
            className="flex-row items-center gap-3.5 p-5 bg-surface active:bg-pressed"
          >
            <Avatar name={user.nickname} uri={user.avatarUrl} size={56} />
            <View className="flex-1">
              <Text className="text-xl font-bold text-fg-strong">{user.nickname}</Text>
              <Text className="mt-0.5 text-sm text-fg-weak">{user.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.weak} />
          </Pressable>
          <View className="flex-row gap-2 px-5 pb-5 bg-surface mb-3">
            <Button title="채널 만들기" variant="secondary" className="flex-1" onPress={() => router.push('/channel-form')} />
            <Button
              title="로그아웃"
              variant="ghost"
              className="flex-1"
              // 한 번 더 확인한다
              onPress={() =>
                Alert.alert('로그아웃할까요?', '이 기기에서 로그아웃해요.', [
                  { text: '취소', style: 'cancel' },
                  { text: '로그아웃', style: 'destructive', onPress: signOut },
                ])
              }
            />
          </View>
          <View className="bg-surface mb-3">
            {MENU.map(([icon, label, href]) => (
              <Pressable key={label} accessibilityRole="link" onPress={() => router.push(href)} className="flex-row items-center gap-3.5 px-5 py-3.5 active:bg-pressed">
                <Ionicons name={icon} size={21} color={c.sub} />
                <Text className="flex-1 text-base text-fg-strong">{label}</Text>
                {href === '/points' ? <Text className="text-[15px] font-semibold text-primary">{(user.points ?? 0).toLocaleString()}P</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={c.weak} />
              </Pressable>
            ))}
          </View>
          <View className="bg-surface">
            <SectionTitle>내가 쓴 글</SectionTitle>
          </View>
        </View>
      }
    />
  );
}
