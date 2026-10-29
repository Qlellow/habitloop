import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, compact, useAcceptInvite, useAuth, useInvite } from '@loop/shared';
import { Button, ChannelIcon, Empty, Loading } from '../../src/ui';
import { toast } from '../../src/Toast';

/** 초대 링크 (https://사이트/invite/코드 를 앱에서 열었을 때): 채널을 보여 주고 팔로우 */
export default function InviteScreen() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { isLoggedIn } = useAuth();
  const { data, error, isPending } = useInvite(code);
  const accept = useAcceptInvite();
  if (isPending) return <Loading />;
  if (!data) return <Empty>{error instanceof ApiError && error.status === 404 ? '초대가 만료됐거나 없는 코드예요' : (error?.message ?? '초대를 불러오지 못했어요')}</Empty>;
  const open = () => router.replace(`/c/${data.slug}`);
  return (
    <View className="flex-1 bg-surface p-6 pt-12 items-center">
      <ChannelIcon slug={data.slug} name={data.name} color={data.color} iconVersion={data.iconVersion} size={72} />
      <Text className="mt-4 text-2xl font-bold text-fg-strong">{data.name}</Text>
      <Text className="mt-1 text-sm text-fg-weak">팔로워 {compact(data.memberCount)}명</Text>
      <Text className="mt-5 mb-8 text-center text-[15px] leading-[22px] text-fg-sub">
        {data.joined ? '이미 팔로우하고 있는 채널이에요.' : `'${data.name}' 채널에 초대받았어요.\n팔로우하면 글을 보고 쓸 수 있어요.`}
      </Text>
      {data.joined ? (
        <Button title="채널로 가기" size="lg" full onPress={open} />
      ) : isLoggedIn ? (
        <Button
          title="팔로우하고 들어가기"
          size="lg"
          full
          loading={accept.isPending}
          onPress={() => accept.mutate(code, { onSuccess: () => (toast(`${data.name} 채널을 팔로우했어요`), open()), onError: (e) => toast(e.message) })}
        />
      ) : (
        <Button title="로그인하고 팔로우하기" size="lg" full onPress={() => router.push('/login')} />
      )}
    </View>
  );
}
