import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CODE_LENGTH, safeNext, useSignup, useSignupCode } from '@loop/shared';
import { CodeField, CodeTimer, useCodeTimer } from '../components/CodeField';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * 회원가입: 정보 입력 → '인증하기'를 누르면 이메일 인증 화면으로 넘어간다.
 * 인증 화면은 ?step=verify 로 따로 두어서 브라우저 뒤로 가기로 입력 화면에 돌아갈 수 있다 (입력한 값은 그대로).
 */
export default function SignupPage() {
  const [params, setParams] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const signup = useSignup();
  const sendCode = useSignupCode();
  const timer = useCodeTimer();
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [code, setCode] = useState('');
  // 인증번호를 보낸 이메일. 이메일을 고치면 다시 받아야 한다
  const [sentTo, setSentTo] = useState<string>();
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const email = form.email.trim().toLowerCase();
  const formValid = EMAIL.test(form.email) && form.password.length >= 8 && form.nickname.trim().length >= 2;
  // 새로고침 등으로 보낸 기록이 없으면 인증 화면 대신 입력 화면을 보여 준다
  const verifying = params.get('step') === 'verify' && !!sentTo && sentTo === email;

  const goVerify = () => {
    const p = new URLSearchParams(params);
    p.set('step', 'verify');
    setParams(p);
  };

  const requestCode = (then?: () => void) =>
    sendCode.mutate(email, {
      onSuccess: () => {
        setSentTo(email);
        setCode('');
        timer.restart();
        signup.reset();
        toast(`${email}(으)로 인증번호를 보냈어요`);
        then?.();
      },
    });

  const startVerify = (e: FormEvent) => {
    e.preventDefault();
    if (!formValid || sendCode.isPending) return;
    // 같은 이메일로 방금 받은 번호가 아직 살아 있으면 다시 보내지 않고 넘어간다
    if (sentTo === email && !timer.expired) return goVerify();
    requestCode(goVerify);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    signup.mutate({ ...form, email, code }, { onSuccess: () => navigate(next, { replace: true }), onError: () => setCode('') });
  };

  if (verifying) {
    return (
      <Page variant="narrow">
        <form className={cn(ui.card, s.authCard)} onSubmit={submit} noValidate>
          <h1 className={s.authTitle}>이메일 인증</h1>
          <p className={s.authDesc}>
            <b className="text-fg-strong">{email}</b>(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
            <br />
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <div className={ui.field}>
            <CodeField value={code} onChange={setCode} autoFocus invalid={!!signup.error && !code} />
            <CodeTimer timer={timer} pending={sendCode.isPending} onResend={() => requestCode()} />
          </div>
          {(signup.error ?? sendCode.error) && <p className={ui.error}>{(signup.error ?? sendCode.error)!.message}</p>}
          <button
            type="submit"
            className={cn(ui.button, ui.primary, ui.large, ui.full)}
            disabled={code.length !== CODE_LENGTH || timer.expired || signup.isPending}
          >
            {signup.isPending ? '가입 중…' : '인증하고 가입하기'}
          </button>
          <div className={s.codeActions}>
            <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => navigate(-1)}>
              ← 입력한 정보 고치기
            </button>
          </div>
        </form>
      </Page>
    );
  }

  return (
    <Page variant="narrow">
      <form className={cn(ui.card, s.authCard)} onSubmit={startVerify} noValidate>
        <h1 className={s.authTitle}>회원가입</h1>
        <p className={s.authDesc}>이메일 인증만 거치면 바로 시작할 수 있어요.</p>
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
        {sendCode.error && <p className={ui.error}>{sendCode.error.message}</p>}
        <button type="submit" className={cn(ui.button, ui.primary, ui.large, ui.full)} disabled={!formValid || sendCode.isPending}>
          {sendCode.isPending ? '인증번호 보내는 중…' : '인증하기'}
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
