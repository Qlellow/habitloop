'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, email, password, nickname }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? '로그인 실패');
      return;
    }
    router.push('/habits');
    router.refresh();
  }

  return (
    <div>
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
        {mode === 'signup' && (
          <input placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        )}
        <input placeholder="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
        <button type="submit">{mode === 'login' ? '로그인' : '가입하기'}</button>
      </form>
      <button
        style={{ marginTop: 12, background: 'none', border: 'none', color: '#7ce0c6', cursor: 'pointer' }}
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
      >
        {mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
      </button>
    </div>
  );
}
