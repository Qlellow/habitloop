import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, useAuthMutation } from '@loop/shared';
import { Page } from '../components/Layout';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const login = useAuthMutation('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(next, { replace: true }) });
  };

  return (
    <Page variant="narrow">
      <form className={cn(ui.card, s.authCard)} onSubmit={submit} noValidate>
        <h1 className={s.authTitle}>로그인</h1>
        <p className={s.authDesc}>루프에 다시 오신 걸 환영해요.</p>
        <label className={ui.field}>
          <span className={ui.label}>이메일</span>
          <input
            className={ui.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>비밀번호</span>
          <input
            className={ui.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {login.error && <p className={ui.error}>{login.error.message}</p>}
        <button
          type="submit"
          className={cn(ui.button, ui.primary, ui.large, ui.full)}
          disabled={!email || !password || login.isPending}
        >
          {login.isPending ? '확인 중…' : '로그인'}
        </button>
        <p className={s.authSwitch}>
          처음이신가요?
          <Link to={`/signup?next=${encodeURIComponent(next)}`} replace>
            회원가입
          </Link>
        </p>
        {import.meta.env.DEV && <p className={s.hint}>체험 계정: demo@loop.dev / password1234</p>}
      </form>
    </Page>
  );
}
