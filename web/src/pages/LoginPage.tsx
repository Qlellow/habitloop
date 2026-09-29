import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, useLogin, useResendLoginCode, useVerifyLogin } from '@loop/shared';
import { CodeField, useCooldown } from '../components/CodeField';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

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
  // 로그인하면서 번호를 방금 보냈으니 다시 받기는 잠깐 기다린다
  const cooldown = useCooldown(60, true);
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    verify.mutate({ challenge, code }, { onSuccess: onDone, onError: () => setCode('') });
  };

  return (
    <form className={cn(ui.card, s.authCard)} onSubmit={submit} noValidate>
      <h1 className={s.authTitle}>2단계 인증</h1>
      <p className={s.authDesc}>
        {maskedEmail ?? '가입한 이메일'}(으)로 보낸 인증번호 6자리를 입력해 주세요. 10분 동안 쓸 수 있어요.
      </p>
      <div className={ui.field}>
        <CodeField value={code} onChange={setCode} autoFocus />
      </div>
      {verify.error && <p className={ui.error}>{verify.error.message}</p>}
      <button type="submit" className={cn(ui.button, ui.primary, ui.large, ui.full)} disabled={code.length !== 6 || verify.isPending}>
        {verify.isPending ? '확인 중…' : '확인'}
      </button>
      <div className={s.codeActions}>
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={onBack}>
          ← 다른 계정으로 로그인
        </button>
        <button
          type="button"
          className={cn(ui.button, ui.text, ui.small)}
          disabled={cooldown.left > 0 || resend.isPending}
          onClick={() =>
            resend.mutate(challenge, {
              onSuccess: (res) => {
                setChallenge(res.challenge);
                setCode('');
                cooldown.start();
                toast('인증번호를 다시 보냈어요');
              },
              onError: (e) => toast(e.message),
            })
          }
        >
          {cooldown.left > 0 ? `다시 받기 (${cooldown.left}초)` : '번호 다시 받기'}
        </button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState<{ challenge: string; maskedEmail?: string }>();
  const done = () => navigate(next, { replace: true });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
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
      <Page variant="narrow">
        <TwoFactorStep
          challenge={twoFactor.challenge}
          maskedEmail={twoFactor.maskedEmail}
          onDone={done}
          onBack={() => {
            setTwoFactor(undefined);
            setPassword('');
            login.reset();
          }}
        />
      </Page>
    );
  }

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
