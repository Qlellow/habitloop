import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CODE_LENGTH, useLogin, useResendLoginCode, useVerifyLogin } from '@loop/shared';
import { AuthField, AuthShell, AuthSubmit, authStyles as a, useFieldCheck } from '../components/Auth';
import { CodeField, CodeTimer, useCodeTimer } from '../components/CodeField';
import { AlertCircleIcon, LockLineIcon, MailLineIcon } from '../components/Icons';
import { toast } from '../components/Toast';
import { useReturnTo } from '../lib/authNav';
import { emailError } from '../lib/validate';

/** 2단계 인증: 비밀번호를 확인한 뒤 이메일로 받은 번호를 입력한다 */
function TwoFactorStep({
  challenge: initial,
  maskedEmail,
  onDone,
  onBack,
}: {
  challenge: string;
  maskedEmail?: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const verify = useVerifyLogin();
  const resend = useResendLoginCode();
  // 로그인하면서 번호를 방금 보냈으니 시간을 바로 센다
  const timer = useCodeTimer(true);
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    verify.mutate({ challenge, code }, { onSuccess: onDone, onError: () => setCode('') });
  };

  return (
    <AuthShell
      title="2단계 인증"
      desc={
        <>
          <b className="text-fg-strong">{maskedEmail ?? '가입한 이메일'}</b>(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
        </>
      }
      onSubmit={submit}
    >
      <div className="mb-6">
        <CodeField value={code} onChange={setCode} autoFocus invalid={!!verify.error && !code} />
        <CodeTimer
          timer={timer}
          pending={resend.isPending}
          onResend={() =>
            resend.mutate(challenge, {
              onSuccess: (res) => {
                setChallenge(res.challenge);
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
      {verify.error && (
        <p className={a.formError} role="alert">
          <AlertCircleIcon className="flex-none w-4 h-4" />
          {verify.error.message}
        </p>
      )}
      <AuthSubmit pending={verify.isPending} disabled={code.length !== CODE_LENGTH || timer.expired}>
        확인
      </AuthSubmit>
      <div className={a.subActions}>
        <button type="button" className={a.textButton} onClick={onBack}>
          ← 다른 계정으로 로그인
        </button>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  const next = useReturnTo();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 소셜 로그인에서 2단계 인증이 필요하면 /oauth/callback 이 state 로 challenge 를 넘겨준다
  const handed = (useLocation().state as { twoFactor?: { challenge: string; maskedEmail?: string } } | null)?.twoFactor;
  const [twoFactor, setTwoFactor] = useState<{ challenge: string; maskedEmail?: string } | undefined>(handed);
  const done = () => navigate(next, { replace: true });

  const check = useFieldCheck({
    email: emailError(email),
    password: password ? undefined : '비밀번호를 입력해 주세요',
  });
  // 서버가 "이메일 또는 비밀번호가 맞지 않아요"라고 하면 두 칸을 함께 강조하고 메시지는 비밀번호 칸 아래에
  const wrong = login.error?.message;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!check.submit()) return;
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (res) => {
          if (res.twoFactorRequired && res.challenge) setTwoFactor({ challenge: res.challenge, maskedEmail: res.maskedEmail });
          else done();
        },
      },
    );
  };

  if (twoFactor) {
    return (
      <TwoFactorStep
        challenge={twoFactor.challenge}
        maskedEmail={twoFactor.maskedEmail}
        onDone={done}
        onBack={() => {
          setTwoFactor(undefined);
          setPassword('');
          login.reset();
          check.reset();
        }}
      />
    );
  }

  return (
    <AuthShell
      variant="login"
      title="다시 만나서 반가워요"
      desc="이메일로 로그인하고 오늘의 이야기를 이어 가세요."
      switchText="처음이신가요?"
      switchLink="회원가입"
      switchTo="/signup"
      onSubmit={submit}
      social
      after={import.meta.env.DEV && <p className={a.demo}>체험 계정: demo@loop.dev / password1234</p>}
    >
      <AuthField
        icon={<MailLineIcon />}
        label="이메일"
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(v) => (setEmail(v), login.reset())}
        onBlur={check.blur('email')}
        error={check.error('email')}
        invalid={!!wrong}
        shake={check.attempt}
      />
      <AuthField
        icon={<LockLineIcon />}
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(v) => (setPassword(v), login.reset())}
        onBlur={check.blur('password')}
        error={check.error('password') ?? wrong}
        shake={check.attempt}
        aside={
          <Link to="/password/reset" state={{ email: email.trim() }} className={a.aside}>
            비밀번호 찾기
          </Link>
        }
      />
      <AuthSubmit pending={login.isPending}>로그인</AuthSubmit>
    </AuthShell>
  );
}
