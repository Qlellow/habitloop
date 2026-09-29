import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuthMutation } from '@loop/shared';
import { Button, Input } from '../src/ui';
import { useAuthStyles as useStyles } from '../src/authStyles';

export default function SignupScreen() {
  const s = useStyles();
  const signup = useAuthMutation('signup');
  const [form, setForm] = useState({ nickname: '', email: '', password: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = /^\S+@\S+\.\S+$/.test(form.email) && form.password.length >= 8 && form.nickname.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{'반가워요!\n몇 가지만 알려 주세요'}</Text>
        <Text style={s.label}>닉네임</Text>
        <Input value={form.nickname} onChangeText={set('nickname')} maxLength={20} placeholder="2~20자" autoFocus />
        <Text style={s.label}>이메일</Text>
        <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Text style={s.label}>비밀번호</Text>
        <Input value={form.password} onChangeText={set('password')} secureTextEntry placeholder="8자 이상" textContentType="newPassword" />
        {signup.error ? <Text style={s.error}>{signup.error.message}</Text> : null}
        <Button
          title="가입하기"
          size="lg"
          full
          style={{ marginTop: 28 }}
          loading={signup.isPending}
          disabled={!valid}
          onPress={() => signup.mutate(form, { onSuccess: () => router.back() })}
        />
        <Text style={s.switch}>
          이미 계정이 있나요?{' '}
          <Text style={s.link} onPress={() => router.replace('/login')}>
            로그인
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
