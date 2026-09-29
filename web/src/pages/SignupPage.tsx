import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, useAuthMutation } from '@loop/shared';
import { Page } from '../components/Layout';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

export default function SignupPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const signup = useAuthMutation('signup');
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = /^\S+@\S+\.\S+$/.test(form.email) && form.password.length >= 8 && form.nickname.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    signup.mutate(form, { onSuccess: () => navigate(next, { replace: true }) });
  };

  return (
    <Page variant="narrow">
      <form className={cn(ui.card, s.authCard)} onSubmit={submit} noValidate>
        <h1 className={s.authTitle}>회원가입</h1>
        <p className={s.authDesc}>몇 가지만 입력하면 바로 시작할 수 있어요.</p>
        <label className={ui.field}>
          <span className={ui.label}>닉네임</span>
          <input className={ui.input} value={form.nickname} onChange={set('nickname')} maxLength={20} placeholder="2~20자" autoFocus />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>이메일</span>
          <input className={ui.input} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>비밀번호</span>
          <input
            className={ui.input}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            placeholder="8자 이상"
          />
        </label>
        {signup.error && <p className={ui.error}>{signup.error.message}</p>}
        <button type="submit" className={cn(ui.button, ui.primary, ui.large, ui.full)} disabled={!valid || signup.isPending}>
          {signup.isPending ? '가입 중…' : '가입하기'}
        </button>
        <p className={s.authSwitch}>
          이미 계정이 있나요?
          <Link to={`/login?next=${encodeURIComponent(next)}`} replace>
            로그인
          </Link>
        </p>
      </form>
    </Page>
  );
}
