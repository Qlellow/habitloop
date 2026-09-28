import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthMutation } from '../api/queries';
import { SubHeader } from '../components/Layout';
import { safeNext } from '../lib/safeNext';
import ui from '../components/ui.module.css';
import s from './Auth.module.css';

export default function SignupPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const signup = useAuthMutation('signup');
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    /^\S+@\S+\.\S+$/.test(form.email) && form.password.length >= 8 && form.nickname.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    signup.mutate(form, { onSuccess: () => navigate(next, { replace: true }) });
  };

  return (
    <div className={ui.sheet}>
      <SubHeader backTo="/" />
      <form className={s.wrap} onSubmit={submit} noValidate>
        <h1 className={s.heading}>{'반가워요!\n몇 가지만 알려 주세요'}</h1>
        <label className={ui.field}>
          <span className={ui.label}>닉네임</span>
          <input
            className={ui.input}
            value={form.nickname}
            onChange={set('nickname')}
            maxLength={20}
            placeholder="2~20자"
            autoFocus
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>이메일</span>
          <input
            className={ui.input}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={set('email')}
          />
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
        <p className={s.switch}>
          이미 계정이 있나요?
          <Link to={`/login?next=${encodeURIComponent(next)}`} replace>
            로그인
          </Link>
        </p>
        <div className={ui.bottomCta}>
          <div>
            <button
              type="submit"
              className={`${ui.button} ${ui.primary} ${ui.block}`}
              disabled={!valid || signup.isPending}
            >
              {signup.isPending ? '가입 중…' : '가입하기'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
