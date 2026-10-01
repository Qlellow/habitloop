import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CODE_LENGTH, useNicknameAvailability, useSignup, useSignupCode } from '@loop/shared';
import { AuthField, AuthShell, AuthSubmit, PasswordStrength, authStyles as a, useFieldCheck } from '../components/Auth';
import { CodeField, CodeTimer, useCodeTimer } from '../components/CodeField';
import { AlertCircleIcon, LockLineIcon, MailLineIcon, UserLineIcon } from '../components/Icons';
import { toast } from '../components/Toast';
import { useReturnTo } from '../lib/authNav';
import { EMAIL, confirmError, emailError, nicknameError, passwordError } from '../lib/validate';

type Field = 'nickname' | 'email' | 'password' | 'confirm';

/**
 * 회원가입: 정보 입력 → '인증하기'를 누르면 이메일 인증 화면으로 넘어간다.
 * 인증 화면은 ?step=verify 로 따로 두어서 브라우저 뒤로 가기로 입력 화면에 돌아갈 수 있다 (입력한 값은 그대로).
 */
export default function SignupPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const next = useReturnTo();
  const navigate = useNavigate();
  const signup = useSignup();
  const sendCode = useSignupCode();
  const timer = useCodeTimer();
  const [form, setForm] = useState({ nickname: '', email: '', password: '', confirm: '' });
  const [code, setCode] = useState('');
  // 인증번호를 보낸 이메일. 이메일을 고치면 다시 받아야 한다
  const [sentTo, setSentTo] = useState<string>();
  // 서버가 알려 준 칸별 오류 (이미 가입된 이메일, 이미 쓰는 닉네임). 그 칸을 고치면 지운다
  const [serverError, setServerError] = useState<Partial<Record<Field, string>>>({});

  const email = form.email.trim().toLowerCase();
  const check = useFieldCheck<Field>({
    nickname: nicknameError(form.nickname),
    email: emailError(form.email),
    password: passwordError(form.password),
    confirm: confirmError(form.password, form.confirm),
  });
  const set = (k: Field) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerError((e) => ({ ...e, [k]: undefined }));
  };
  const errorOf = (k: Field) => serverError[k] ?? check.error(k);

  // 닉네임 중복 확인: 입력이 0.4초 멈추면 서버에 물어본다
  const nickname = form.nickname.trim();
  const [nickToCheck, setNickToCheck] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setNickToCheck(nickname), 400);
    return () => clearTimeout(t);
  }, [nickname]);
  const nickCheck = useNicknameAvailability(nickToCheck, !nicknameError(nickToCheck));
  const nickChecked = nickToCheck === nickname && nickCheck.data;
  // 이미 쓰는 닉네임이면 칸을 벗어나기 전에도 바로 알려 준다
  const nickTaken = nickChecked && !nickCheck.data!.available ? nickCheck.data!.reason : undefined;

  // 새로고침 등으로 보낸 기록이 없으면 인증 화면 대신 입력 화면을 보여 준다
  const verifying = params.get('step') === 'verify' && !!sentTo && sentTo === email;

  const goVerify = () => {
    const p = new URLSearchParams(params);
    p.set('step', 'verify');
    // 돌아갈 곳(state)을 잃지 않게 그대로 들고 간다
    setParams(p, { state: location.state });
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
      onError: (e) => {
        // "이미 가입된 이메일이에요" 는 이메일 칸 아래에
        if (e.message.includes('이메일')) setServerError((s) => ({ ...s, email: e.message }));
      },
    });

  const startVerify = (e: FormEvent) => {
    e.preventDefault();
    if (!check.submit() || nickTaken || serverError.email || serverError.nickname || sendCode.isPending) return;
    // 같은 이메일로 방금 받은 번호가 아직 살아 있으면 다시 보내지 않고 넘어간다
    if (sentTo === email && !timer.expired) return goVerify();
    requestCode(goVerify);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    signup.mutate(
      { nickname: form.nickname, email, password: form.password, code },
      {
        onSuccess: () => navigate(next, { replace: true }),
        onError: (err) => {
          setCode('');
          // 닉네임·이메일 문제는 번호와 상관없으니 입력 화면으로 돌아가 그 칸에 보여 준다
          const field: Field | undefined = err.message.includes('닉네임') ? 'nickname' : err.message.includes('가입된 이메일') ? 'email' : undefined;
          if (field) {
            setServerError((s) => ({ ...s, [field]: err.message }));
            navigate(-1);
          }
        },
      },
    );
  };

  if (verifying) {
    return (
      <AuthShell
        variant="signup"
        step="2 / 2 · 이메일 인증"
        title="이메일 인증"
        desc={
          <>
            <b className="text-fg-strong">{email}</b>(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
            <br />
            메일이 안 보이면 스팸함도 확인해 주세요.
          </>
        }
        onSubmit={submit}
      >
        <div className="mb-6">
          <CodeField value={code} onChange={setCode} autoFocus invalid={!!signup.error && !code} />
          <CodeTimer timer={timer} pending={sendCode.isPending} onResend={() => requestCode()} />
        </div>
        {(signup.error ?? sendCode.error) && (
          <p className={a.formError} role="alert">
            <AlertCircleIcon className="flex-none w-4 h-4" />
            {(signup.error ?? sendCode.error)!.message}
          </p>
        )}
        <AuthSubmit pending={signup.isPending} disabled={code.length !== CODE_LENGTH || timer.expired}>
          인증하고 가입하기
        </AuthSubmit>
        <div className={a.subActions}>
          <button type="button" className={a.textButton} onClick={() => navigate(-1)}>
            ← 입력한 정보 고치기
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="signup"
      step="1 / 2 · 정보 입력"
      title="루프 시작하기"
      desc="몇 가지만 알려 주시면 바로 함께할 수 있어요."
      switchText="이미 회원이신가요?"
      switchLink="로그인"
      switchTo="/login"
      onSubmit={startVerify}
    >
      <AuthField
        icon={<UserLineIcon />}
        label="닉네임 (2~20자)"
        autoComplete="nickname"
        autoFocus
        maxLength={20}
        value={form.nickname}
        onChange={set('nickname')}
        onBlur={check.blur('nickname')}
        error={serverError.nickname ?? nickTaken ?? check.error('nickname')}
        valid={!!nickChecked && nickCheck.data!.available && !serverError.nickname}
        shake={check.attempt}
      />
      <AuthField
        icon={<MailLineIcon />}
        label="이메일"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={set('email')}
        onBlur={check.blur('email')}
        error={errorOf('email')}
        valid={EMAIL.test(email) && !serverError.email}
        shake={check.attempt}
      />
      <AuthField
        icon={<LockLineIcon />}
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={set('password')}
        onBlur={check.blur('password')}
        error={check.error('password')}
        valid={!passwordError(form.password)}
        shake={check.attempt}
        hint={<PasswordStrength value={form.password} />}
        hintLines={2}
      />
      <AuthField
        icon={<LockLineIcon />}
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        value={form.confirm}
        onChange={set('confirm')}
        onBlur={check.blur('confirm')}
        // 확인 칸은 다 입력하기 전에도, 앞부분부터 다르면 바로 알려 준다
        error={check.error('confirm') ?? (form.confirm && !form.password.startsWith(form.confirm) ? '비밀번호가 일치하지 않습니다.' : undefined)}
        valid={!!form.confirm && form.confirm === form.password}
        shake={check.attempt}
      />
      {sendCode.error && !sendCode.error.message.includes('이메일') && (
        <p className={a.formError} role="alert">
          <AlertCircleIcon className="flex-none w-4 h-4" />
          {sendCode.error.message}
        </p>
      )}
      <AuthSubmit pending={sendCode.isPending}>이메일 인증하기</AuthSubmit>
    </AuthShell>
  );
}
