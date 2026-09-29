import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuthMutation } from '@loop/shared';
import { Button, Input } from '../src/ui';
import { auth as s } from '../src/authStyles';

export default function LoginScreen() {
  const login = useAuthMutation('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => login.mutate({ email, password }, { onSuccess: () => router.back() });

  return (
    <KeyboardAvoidingView className={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.title}>{'이메일로\n로그인할게요'}</Text>
        <Text className={s.label}>이메일</Text>
        <Input
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
        />
        <Text className={s.label}>비밀번호</Text>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
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
