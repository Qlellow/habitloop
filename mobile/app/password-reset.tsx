import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { cleanCode, CODE_LENGTH, passwordProblem, usePasswordReset } from '@loop/shared';
import { KeyboardArea } from '../src/Keyboard';
import { Button, Input } from '../src/ui';
import { auth as s } from '../src/authStyles';
import { toast } from '../src/Toast';

type Step = { name: 'email' } | { name: 'code'; challenge: string; maskedEmail: string } | { name: 'password'; resetToken: string };

/** 비밀번호 찾기: 가입한 이메일로 번호 받기 → 번호 확인 → 새 비밀번호 (웹 /password/reset 과 같은 흐름) */
export default function PasswordResetScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { sendCode, resend, verify, reset } = usePasswordReset();
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // 보통 로그인 화면에서 들어오므로 그 화면으로 돌아간다 (링크로 바로 열었으면 로그인 화면을 새로 연다)
  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/login', params: { email } }));

  if (step.name === 'code') {
    const submit = () =>
      code.length === CODE_LENGTH &&
      verify.mutate({ challenge: step.challenge, code }, { onSuccess: (r) => setStep({ name: 'password', resetToken: r.resetToken }), onError: () => setCode('') });
    return (
      <KeyboardArea className={s.flex}>
        <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
          <Text className={s.title}>{'이메일로 받은\n인증번호를 입력해 주세요'}</Text>
          <Text className={s.label}>{step.maskedEmail}(으)로 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.</Text>
          <Input
            value={code}
            onChangeText={(v) => setCode(cleanCode(v))}
            autoCapitalize="characters"
            autoCorrect={false}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="6자리 (영문·숫자)"
            autoFocus
            onSubmitEditing={submit}
          />
          {verify.error ? <Text className={s.error}>{verify.error.message}</Text> : null}
          <Button title="확인" size="lg" full className="mt-7" loading={verify.isPending} disabled={code.length !== CODE_LENGTH} onPress={submit} />
          <Button
            title="번호 다시 받기"
            variant="text"
            full
            className="mt-2"
            loading={resend.isPending}
            onPress={() =>
              resend.mutate(step.challenge, {
                onSuccess: (r) => {
                  setStep({ ...step, challenge: r.challenge });
                  setCode('');
                  verify.reset();
                  toast('인증번호를 다시 보냈어요');
                },
                onError: (e) => toast(e.message),
              })
            }
          />
        </ScrollView>
      </KeyboardArea>
    );
  }

  if (step.name === 'password') {
    const problem = password ? passwordProblem(password) : undefined;
    const mismatch = !!confirm && confirm !== password;
    const submit = () =>
      !passwordProblem(password) &&
      confirm === password &&
      reset.mutate(
        { resetToken: step.resetToken, newPassword: password },
        {
          onSuccess: () => {
            toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요');
            backToLogin();
          },
        },
      );
    return (
      <KeyboardArea className={s.flex}>
        <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
          <Text className={s.title}>{'새 비밀번호를\n정해 주세요'}</Text>
          <Text className={s.label}>새 비밀번호</Text>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="8자 이상, 숫자·특수문자 포함" autoFocus />
          {problem ? <Text className={s.error}>{problem}</Text> : null}
          <Text className={s.label}>새 비밀번호 확인</Text>
          <Input value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
          {mismatch ? <Text className={s.error}>비밀번호가 일치하지 않아요</Text> : null}
          {reset.error ? <Text className={s.error}>{reset.error.message}</Text> : null}
          <Button title="비밀번호 바꾸기" size="lg" full className="mt-7" loading={reset.isPending} disabled={!password || !!problem || confirm !== password} onPress={submit} />
        </ScrollView>
      </KeyboardArea>
    );
  }

  const submit = () =>
    email.trim() &&
    sendCode.mutate(email.trim(), { onSuccess: (r) => (setStep({ name: 'code', ...r }), setCode('')) });
  return (
    <KeyboardArea className={s.flex}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.title}>{'가입한 이메일로\n인증번호를 보내 드릴게요'}</Text>
        <Text className={s.label}>이메일</Text>
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus onSubmitEditing={submit} />
        {sendCode.error ? <Text className={s.error}>{sendCode.error.message}</Text> : null}
        <Button title="인증번호 받기" size="lg" full className="mt-7" loading={sendCode.isPending} disabled={!email.trim()} onPress={submit} />
        <Text className={s.switch}>
          비밀번호가 기억났나요?{' '}
          <Text className={s.link} onPress={backToLogin}>
            로그인
          </Text>
        </Text>
      </ScrollView>
    </KeyboardArea>
  );
}
