import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthMutation } from '../api/queries';
import { SubHeader } from '../components/Layout';
import { safeNext } from '../lib/safeNext';
import ui from '../components/ui.module.css';
import s from './Auth.module.css';

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
    <div className={ui.sheet}>
      <SubHeader backTo="/" />
      <form className={s.wrap} onSubmit={submit} noValidate>
        <h1 className={s.heading}>{'이메일로\n로그인할게요'}</h1>
        <label className={ui.field}>
          <span className={ui.label}>이메일</span>
          <input
            className={ui.input}
            type="email"
            autoComplete="email"
            inputMode="email"
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
        <p className={s.switch}>
          처음이신가요?
          <Link to={`/signup?next=${encodeURIComponent(next)}`} replace>
            회원가입
          </Link>
        </p>
        {import.meta.env.DEV && <p className={s.hint}>체험 계정: demo@loop.dev / password1234</p>}
        <div className={ui.bottomCta}>
          <div>
            <button
              type="submit"
              className={`${ui.button} ${ui.primary} ${ui.block}`}
              disabled={!email || !password || login.isPending}
            >
              {login.isPending ? '확인 중…' : '로그인'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
