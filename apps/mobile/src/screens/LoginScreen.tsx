import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { login, signup } from '../api/client';

export default function LoginScreen({ navigation }: any) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  async function submit() {
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password, nickname);
      navigation.replace('Habits');
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.message ?? '로그인/가입 실패');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔁 HabitLoop</Text>
      {mode === 'signup' && (
        <TextInput style={styles.input} placeholder="닉네임" placeholderTextColor="#888" value={nickname} onChangeText={setNickname} />
      )}
      <TextInput style={styles.input} placeholder="이메일" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>{mode === 'login' ? '로그인' : '가입하기'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.link}>{mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', padding: 24, justifyContent: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#1b1e26', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#7ce0c6', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0f1115', fontWeight: '700' },
  link: { color: '#7ce0c6', textAlign: 'center', marginTop: 16 },
});
