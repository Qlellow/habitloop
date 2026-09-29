import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { useLogin, useResendLoginCode, useVerifyLogin } from '@loop/shared';
import { Button, Input } from '../src/ui';
import { auth as s } from '../src/authStyles';

export default function LoginScreen() {
  const login = useLogin();
  const verify = useVerifyLogin();
  const resend = useResendLoginCode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 2단계 인증이 켜진 계정: 비밀번호 확인 뒤 이메일로 받은 번호를 입력한다
  const [twoFactor, setTwoFactor] = useState<{ challenge: string; maskedEmail?: string }>();
  const [code, setCode] = useState('');

  const submit = () =>
    login.mutate(
      { email, password },
      {
        onSuccess: (res) => {
          if (res.twoFactorRequired && res.challenge) setTwoFactor({ challenge: res.challenge, maskedEmail: res.maskedEmail });
          else router.back();
        },
      },
    );
  const confirm = () =>
    twoFactor && verify.mutate({ challenge: twoFactor.challenge, code }, { onSuccess: () => router.back(), onError: () => setCode('') });

  if (twoFactor) {
    return (
      <KeyboardAvoidingView className={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
          <Text className={s.title}>{'이메일로 받은\n인증번호를 입력해 주세요'}</Text>
          <Text className={s.label}>{twoFactor.maskedEmail ?? '가입한 이메일'}(으)로 보냈어요</Text>
          <Input
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="숫자 6자리"
            autoFocus
            onSubmitEditing={confirm}
          />
          {verify.error ? <Text className={s.error}>{verify.error.message}</Text> : null}
          {resend.error ? <Text className={s.error}>{resend.error.message}</Text> : null}
          <Button title="확인" size="lg" full className="mt-7" loading={verify.isPending} disabled={code.length !== 6} onPress={confirm} />
          <Button
            title="번호 다시 받기"
            variant="text"
            full
            className="mt-2"
            loading={resend.isPending}
            onPress={() => resend.mutate(twoFactor.challenge, { onSuccess: (r) => setTwoFactor({ ...twoFactor, challenge: r.challenge }) })}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView className={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.title}>{'이메일로\n로그인할게요'}</Text>
        <Text className={s.label}>이메일</Text>
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus />
        <Text className={s.label}>비밀번호</Text>
        <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
        {login.error ? <Text className={s.error}>{login.error.message}</Text> : null}
        <Button title="로그인" size="lg" full className="mt-7" loading={login.isPending} disabled={!email || !password} onPress={submit} />
        <Text className={s.switch}>
          처음이신가요?{' '}
          <Text className={s.link} onPress={() => router.replace('/signup')}>
            회원가입
          </Text>
        </Text>
        {__DEV__ ? <Text className={s.hint}>체험 계정: demo@loop.dev / password1234</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
