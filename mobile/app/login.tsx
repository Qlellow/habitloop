import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardArea } from '../src/Keyboard';
import { router, useLocalSearchParams } from 'expo-router';
import { cleanCode, CODE_LENGTH, useLogin, useOAuthProviders, useResendLoginCode, useVerifyLogin, type OAuthProvider } from '@loop/shared';
import { Button, Input } from '../src/ui';
import { auth as s } from '../src/authStyles';
import { leave } from '../src/nav';
import { startSocialLogin } from '../src/socialLogin';
import { cn } from '../src/cn';

const SOCIAL: Record<OAuthProvider, { label: string; className: string; text: string }> = {
  kakao: { label: '카카오로 계속하기', className: 'bg-[#FEE500]', text: 'text-[#191919]' },
  naver: { label: '네이버로 계속하기', className: 'bg-[#03C75A]', text: 'text-white' },
  google: { label: 'Google 로 계속하기', className: 'bg-surface border border-border', text: 'text-fg-strong' },
};

/** 소셜 로그인 버튼: 서버에 키가 설정된 것만 보인다 */
function SocialButtons({ onTwoFactor }: { onTwoFactor: (t: { challenge: string; maskedEmail?: string }) => void }) {
  const providers = useOAuthProviders().data ?? [];
  const [busy, setBusy] = useState<OAuthProvider>();
  const [error, setError] = useState<string>();
  if (!providers.length) return null;
  const go = async (p: OAuthProvider) => {
    if (busy) return;
    setBusy(p);
    setError(undefined);
    try {
      const r = await startSocialLogin(p);
      if ('twoFactor' in r) onTwoFactor(r.twoFactor);
      else if ('done' in r) leave();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <View className="mt-8 gap-2.5">
      <Text className="mb-1 text-center text-[13px] text-fg-weak">소셜 계정으로 계속하기</Text>
      {(['kakao', 'naver', 'google'] as const)
        .filter((p) => providers.includes(p))
        .map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            onPress={() => go(p)}
            disabled={!!busy}
            className={cn('h-[52px] rounded-md items-center justify-center active:opacity-80', SOCIAL[p].className, busy && busy !== p && 'opacity-50')}
          >
            <Text className={cn('text-base font-semibold', SOCIAL[p].text)}>{busy === p ? '로그인하는 중…' : SOCIAL[p].label}</Text>
          </Pressable>
        ))}
      {error ? <Text className={s.error}>{error}</Text> : null}
    </View>
  );
}

export default function LoginScreen() {
  const login = useLogin();
  const verify = useVerifyLogin();
  const resend = useResendLoginCode();
  const params = useLocalSearchParams<{ email?: string; challenge?: string; masked?: string }>();
  // 비밀번호를 바꾸고 돌아왔을 때 이메일을 채워 둔다
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  // 2단계 인증이 켜진 계정: 비밀번호 확인 뒤 이메일로 받은 번호를 입력한다
  // 소셜 로그인이 앱 링크로 끝나 2단계 인증이 필요하면 challenge 를 받아 바로 이 단계로 (app/oauth.tsx)
  const [twoFactor, setTwoFactor] = useState<{ challenge: string; maskedEmail?: string } | undefined>(
    params.challenge ? { challenge: params.challenge, maskedEmail: params.masked } : undefined,
  );
  const [code, setCode] = useState('');

  const submit = () =>
    login.mutate(
      { email, password },
      {
        onSuccess: (res) => {
          if (res.twoFactorRequired && res.challenge) setTwoFactor({ challenge: res.challenge, maskedEmail: res.maskedEmail });
          else leave();
        },
      },
    );
  const confirm = () =>
    twoFactor && verify.mutate({ challenge: twoFactor.challenge, code }, { onSuccess: leave, onError: () => setCode('') });

  if (twoFactor) {
    return (
      <KeyboardArea className={s.flex}>
        <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
          <Text className={s.title}>{'이메일로 받은\n인증번호를 입력해 주세요'}</Text>
          <Text className={s.label}>{twoFactor.maskedEmail ?? '가입한 이메일'}(으)로 보냈어요</Text>
          <Input
            value={code}
            onChangeText={(v) => setCode(cleanCode(v))}
            autoCapitalize="characters"
            autoCorrect={false}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="6자리 (영문·숫자)"
            autoFocus
            onSubmitEditing={confirm}
          />
          {verify.error ? <Text className={s.error}>{verify.error.message}</Text> : null}
          {resend.error ? <Text className={s.error}>{resend.error.message}</Text> : null}
          <Button title="확인" size="lg" full className="mt-7" loading={verify.isPending} disabled={code.length !== CODE_LENGTH} onPress={confirm} />
          <Button
            title="번호 다시 받기"
            variant="text"
            full
            className="mt-2"
            loading={resend.isPending}
            onPress={() => resend.mutate(twoFactor.challenge, { onSuccess: (r) => setTwoFactor({ ...twoFactor, challenge: r.challenge }) })}
          />
        </ScrollView>
      </KeyboardArea>
    );
  }

  return (
    <KeyboardArea className={s.flex}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.title}>{'이메일로\n로그인할게요'}</Text>
        <Text className={s.label}>이메일</Text>
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus />
        <Text className={s.label}>비밀번호</Text>
        <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
        {login.error ? <Text className={s.error}>{login.error.message}</Text> : null}
        <Button title="로그인" size="lg" full className="mt-7" loading={login.isPending} disabled={!email || !password} onPress={submit} />
        <Button title="비밀번호를 잊었나요?" variant="text" full className="mt-2" onPress={() => router.push({ pathname: '/password-reset', params: { email } })} />
        <Text className={s.switch}>
          처음이신가요?{' '}
          <Text className={s.link} onPress={() => router.replace('/signup')}>
            회원가입
          </Text>
        </Text>
        <SocialButtons onTwoFactor={setTwoFactor} />
        {__DEV__ ? <Text className={s.hint}>체험 계정: demo@loop.dev / password1234</Text> : null}
      </ScrollView>
    </KeyboardArea>
  );
}
