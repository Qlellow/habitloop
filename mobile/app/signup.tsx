import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSignup, useSignupCode } from '@loop/shared';
import { Button, Input } from '../src/ui';
import { auth as s } from '../src/authStyles';

export default function SignupScreen() {
  const signup = useSignup();
  const sendCode = useSignupCode();
  const [form, setForm] = useState({ nickname: '', email: '', password: '', code: '' });
  // 인증번호를 보낸 이메일. 이메일을 고치면 다시 받아야 한다
  const [sentTo, setSentTo] = useState<string>();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const email = form.email.trim().toLowerCase();
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const sent = !!sentTo && sentTo === email;
  const valid = emailOk && sent && form.code.length === 6 && form.password.length >= 8 && form.nickname.trim().length >= 2;

  return (
    <KeyboardAvoidingView className={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.title}>{'반가워요!\n몇 가지만 알려 주세요'}</Text>
        <Text className={s.label}>닉네임</Text>
        <Input value={form.nickname} onChangeText={set('nickname')} maxLength={20} placeholder="2~20자" autoFocus />
        <Text className={s.label}>이메일</Text>
        <View className="flex-row gap-2">
          <Input className="flex-1" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Button
            title={sent ? '다시 받기' : '인증번호 받기'}
            variant="secondary"
            className="h-auto"
            disabled={!emailOk}
            loading={sendCode.isPending}
            onPress={() => sendCode.mutate(email, { onSuccess: () => setSentTo(email) })}
          />
        </View>
        {sendCode.error ? <Text className={s.error}>{sendCode.error.message}</Text> : null}
        {sent ? (
          <>
            <Text className={s.label}>인증번호</Text>
            <Input
              value={form.code}
              onChangeText={(v) => set('code')(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="메일로 받은 숫자 6자리"
            />
          </>
        ) : null}
        <Text className={s.label}>비밀번호</Text>
        <Input value={form.password} onChangeText={set('password')} secureTextEntry placeholder="8자 이상" textContentType="newPassword" />
        {signup.error ? <Text className={s.error}>{signup.error.message}</Text> : null}
        <Button
          title="가입하기"
          size="lg"
          full
          className="mt-7"
          loading={signup.isPending}
          disabled={!valid}
          onPress={() => signup.mutate({ ...form, email }, { onSuccess: () => router.back() })}
        />
        <Text className={s.switch}>
          이미 계정이 있나요?{' '}
          <Text className={s.link} onPress={() => router.replace('/login')}>
            로그인
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
