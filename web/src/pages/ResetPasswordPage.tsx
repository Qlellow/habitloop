import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CODE_LENGTH, usePasswordReset } from '@loop/shared';
import { AuthField, AuthShell, AuthSubmit, PasswordStrength, authStyles as a, useFieldCheck } from '../components/Auth';
import { CodeField, CodeTimer, useCodeTimer } from '../components/CodeField';
import { AlertCircleIcon, LockLineIcon, MailLineIcon } from '../components/Icons';
import { toast } from '../components/Toast';
import { EMAIL, confirmError, emailError, passwordError } from '../lib/validate';

type Step =
  | { name: 'email' }
  | { name: 'code'; challenge: string; maskedEmail: string }
  | { name: 'password'; resetToken: string };

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={a.formError} role="alert">
      <AlertCircleIcon className="flex-none w-4 h-4" />
      {message}
    </p>
  );
}

/**
 * 비밀번호 찾기: 가입한 이메일 입력 → 이메일로 받은 인증번호 확인 → 새 비밀번호.
 * 2단계 인증을 켰는지와 상관없이 항상 이메일 인증을 거친다 (이메일만 알면 남의 비밀번호를 바꿀 수 있으면 안 된다).
 */
export default function ResetPasswordPage() {
  // 로그인 화면에서 적어 둔 이메일 (주소에 넣지 않고 state 로 받는다)
  const prefill = (useLocation().state as { email?: string } | null)?.email ?? '';
  const navigate = useNavigate();
  const { sendCode, resend, verify, reset } = usePasswordReset();
  const timer = useCodeTimer();
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState(prefill);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const emailCheck = useFieldCheck({ email: emailError(email) });
  const pwCheck = useFieldCheck({ password: passwordError(password), confirm: confirmError(password, confirm) });

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
      <AuthShell
        title="이메일 인증"
        desc={
          <>
            <b className="text-fg-strong">{step.maskedEmail}</b>(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
            <br />
            메일이 안 보이면 스팸함도 확인해 주세요.
          </>
        }
        onSubmit={submitCode}
      >
        <div className="mb-6">
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
        <FormError message={verify.error?.message} />
        <AuthSubmit pending={verify.isPending} disabled={code.length !== CODE_LENGTH || timer.expired}>
          확인
        </AuthSubmit>
        <div className={a.subActions}>
          <button type="button" className={a.textButton} onClick={() => (setStep({ name: 'email' }), verify.reset())}>
            ← 이메일 다시 입력
          </button>
        </div>
      </AuthShell>
    );
  }

  if (step.name === 'password') {
    const submitPassword = (e: FormEvent) => {
      e.preventDefault();
      if (!pwCheck.submit()) return;
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
      <AuthShell title="새 비밀번호" desc="앞으로 로그인할 때 쓸 비밀번호를 정해 주세요." onSubmit={submitPassword}>
        <AuthField
          icon={<LockLineIcon />}
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={setPassword}
          onBlur={pwCheck.blur('password')}
          error={pwCheck.error('password')}
          valid={!passwordError(password)}
          shake={pwCheck.attempt}
          hint={<PasswordStrength value={password} />}
        hintLines={2}
        />
        <AuthField
          icon={<LockLineIcon />}
          label="새 비밀번호 확인"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          onBlur={pwCheck.blur('confirm')}
          error={pwCheck.error('confirm') ?? (confirm && !password.startsWith(confirm) ? '비밀번호가 일치하지 않습니다.' : undefined)}
          valid={!!confirm && confirm === password}
          shake={pwCheck.attempt}
        />
        <FormError message={reset.error?.message} />
        <AuthSubmit pending={reset.isPending}>비밀번호 바꾸기</AuthSubmit>
      </AuthShell>
    );
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!emailCheck.submit()) return;
    sendCode.mutate(email.trim(), {
      onSuccess: (res) => {
        setStep({ name: 'code', ...res });
        setCode('');
        timer.restart();
      },
    });
  };

  return (
    <AuthShell
      title="비밀번호 찾기"
      desc="가입한 이메일을 입력하면 인증번호를 보내 드려요."
      switchText="비밀번호가 기억났나요?"
      switchLink="로그인"
      switchTo="/login"
      switchTransition={false}
      onSubmit={submitEmail}
    >
      <AuthField
        icon={<MailLineIcon />}
        label="가입한 이메일"
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(v) => (setEmail(v), sendCode.reset())}
        onBlur={emailCheck.blur('email')}
        // "가입된 이메일이 아니에요" 같은 서버 응답도 이메일 칸 아래에
        error={emailCheck.error('email') ?? sendCode.error?.message}
        valid={EMAIL.test(email.trim()) && !sendCode.error}
        shake={emailCheck.attempt}
      />
      <AuthSubmit pending={sendCode.isPending}>인증번호 받기</AuthSubmit>
    </AuthShell>
  );
}
