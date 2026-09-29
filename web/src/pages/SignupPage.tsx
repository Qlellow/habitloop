import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, useSignup, useSignupCode } from '@loop/shared';
import { CodeField, useCooldown } from '../components/CodeField';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

const EMAIL = /^\S+@\S+\.\S+$/;

export default function SignupPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const signup = useSignup();
  const sendCode = useSignupCode();
  const cooldown = useCooldown();
  const [form, setForm] = useState({ email: '', password: '', nickname: '', code: '' });
  // 인증번호를 보낸 이메일. 이메일을 고치면 다시 받아야 한다
  const [sentTo, setSentTo] = useState<string>();
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const email = form.email.trim().toLowerCase();
  const sent = !!sentTo && sentTo === email;
  const valid = EMAIL.test(form.email) && form.password.length >= 8 && form.nickname.trim().length >= 2 && sent && form.code.length === 6;

  const requestCode = () =>
    sendCode.mutate(email, {
      onSuccess: () => {
        setSentTo(email);
        setForm((f) => ({ ...f, code: '' }));
        cooldown.start();
        toast(`${email}(으)로 인증번호를 보냈어요`);
      },
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    signup.mutate({ ...form, email }, { onSuccess: () => navigate(next, { replace: true }) });
  };

  return (
    <Page variant="narrow">
      <form className={cn(ui.card, s.authCard)} onSubmit={submit} noValidate>
        <h1 className={s.authTitle}>회원가입</h1>
        <p className={s.authDesc}>이메일 인증만 거치면 바로 시작할 수 있어요.</p>
        <label className={ui.field}>
          <span className={ui.label}>닉네임</span>
          <input className={ui.input} value={form.nickname} onChange={set('nickname')} maxLength={20} placeholder="2~20자" autoFocus />
        </label>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="signup-email">
            이메일
          </label>
          <div className={s.codeRow}>
            <input id="signup-email" className={ui.input} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
            <button
              type="button"
              className={cn(ui.button, ui.secondary, 'h-auto')}
              disabled={!EMAIL.test(form.email) || sendCode.isPending || (sent && cooldown.left > 0)}
              onClick={requestCode}
            >
              {sendCode.isPending ? '보내는 중…' : sent ? (cooldown.left > 0 ? `${cooldown.left}초` : '다시 받기') : '인증번호 받기'}
            </button>
          </div>
          {sendCode.error && <p className={cn(ui.error, 'mt-1.5 mb-0')}>{sendCode.error.message}</p>}
        </div>
        {sent && (
          <div className={ui.field}>
            <span className={ui.label}>인증번호</span>
            <CodeField value={form.code} onChange={(code) => setForm((f) => ({ ...f, code }))} autoFocus />
            <p className={ui.help}>메일이 안 보이면 스팸함도 확인해 주세요. 번호는 10분 동안 쓸 수 있어요.</p>
          </div>
        )}
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
