import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CODE_LENGTH, usePasswordReset } from '@loop/shared';
import { CodeField, CodeTimer, useCodeTimer } from '../components/CodeField';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

const EMAIL = /^\S+@\S+\.\S+$/;

type Step =
  | { name: 'email' }
  | { name: 'code'; challenge: string; maskedEmail: string }
  | { name: 'password'; resetToken: string };

/**
 * 비밀번호 재설정: 가입한 이메일 입력 → 이메일로 받은 인증번호 확인 → 새 비밀번호.
 * 2단계 인증을 켰는지와 상관없이 항상 이메일 인증을 거친다 (이메일만 알면 남의 비밀번호를 바꿀 수 있으면 안 된다).
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { sendCode, resend, verify, reset } = usePasswordReset();
  const timer = useCodeTimer();
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return;
    sendCode.mutate(email.trim(), {
      onSuccess: (res) => {
        setStep({ name: 'code', ...res });
        setCode('');
        timer.restart();
      },
    });
  };

  if (step.name === 'code') {
    const submitCode = (e: FormEvent) => {
      e.preventDefault();
      if (code.length !== CODE_LENGTH) return;
      verify.mutate(
        { challenge: step.challenge, code },
        { onSuccess: (res) => setStep({ name: 'password', resetToken: res.resetToken }), onError: () => setCode('') },
      );
    };
    return (
      <Page variant="narrow">
        <form className={cn(ui.card, s.authCard)} onSubmit={submitCode} noValidate>
          <h1 className={s.authTitle}>이메일 인증</h1>
          <p className={s.authDesc}>
            <b className="text-fg-strong">{step.maskedEmail}</b>(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
            <br />
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <div className={ui.field}>
            <CodeField value={code} onChange={setCode} autoFocus invalid={!!verify.error && !code} />
            <CodeTimer
              timer={timer}
              pending={resend.isPending}
              onResend={() =>
                resend.mutate(step.challenge, {
                  onSuccess: (res) => {
                    setStep({ ...step, challenge: res.challenge });
                    setCode('');
                    verify.reset();
                    timer.restart();
                    toast('인증번호를 다시 보냈어요');
                  },
                  onError: (e) => toast(e.message),
                })
              }
            />
          </div>
          {verify.error && <p className={ui.error}>{verify.error.message}</p>}
          <button
            type="submit"
            className={cn(ui.button, ui.primary, ui.large, ui.full)}
            disabled={code.length !== CODE_LENGTH || timer.expired || verify.isPending}
          >
            {verify.isPending ? '확인 중…' : '확인'}
          </button>
          <div className={s.codeActions}>
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small)}
              onClick={() => {
                setStep({ name: 'email' });
                verify.reset();
              }}
            >
              ← 이메일 다시 입력
            </button>
          </div>
        </form>
      </Page>
    );
  }

  if (step.name === 'password') {
    const mismatch = confirm.length > 0 && confirm !== password;
    const valid = password.length >= 8 && password === confirm;
    const submitPassword = (e: FormEvent) => {
      e.preventDefault();
      if (!valid) return;
      reset.mutate(
        { resetToken: step.resetToken, newPassword: password },
        {
          onSuccess: () => {
            toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요');
            navigate('/login', { replace: true });
          },
        },
      );
    };
    return (
      <Page variant="narrow">
        <form className={cn(ui.card, s.authCard)} onSubmit={submitPassword} noValidate>
          <h1 className={s.authTitle}>새 비밀번호</h1>
          <p className={s.authDesc}>앞으로 로그인할 때 쓸 비밀번호를 정해 주세요.</p>
          <label className={ui.field}>
            <span className={ui.label}>새 비밀번호</span>
            <input
              className={ui.input}
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          <label className={ui.field}>
            <span className={ui.label}>새 비밀번호 확인</span>
            <input
              className={ui.input}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <p className={cn(ui.error, 'mt-1.5 mb-0')}>비밀번호가 서로 달라요</p>}
          </label>
          {reset.error && <p className={ui.error}>{reset.error.message}</p>}
          <button type="submit" className={cn(ui.button, ui.primary, ui.large, ui.full)} disabled={!valid || reset.isPending}>
            {reset.isPending ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </button>
        </form>
      </Page>
    );
  }

  return (
    <Page variant="narrow">
      <form className={cn(ui.card, s.authCard)} onSubmit={submitEmail} noValidate>
        <h1 className={s.authTitle}>비밀번호 재설정</h1>
        <p className={s.authDesc}>가입한 이메일을 입력하면 인증번호를 보내 드려요.</p>
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
        {sendCode.error && <p className={ui.error}>{sendCode.error.message}</p>}
        <button
          type="submit"
          className={cn(ui.button, ui.primary, ui.large, ui.full)}
          disabled={!EMAIL.test(email.trim()) || sendCode.isPending}
        >
          {sendCode.isPending ? '보내는 중…' : '인증번호 받기'}
        </button>
        <p className={s.authSwitch}>
          비밀번호가 기억났나요?
          <Link to="/login" replace>
            로그인
          </Link>
        </p>
      </form>
    </Page>
  );
}
