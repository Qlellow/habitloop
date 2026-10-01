import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, BackIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from './Icons';
import { LogoMark } from './Layout';
import { useAuthState } from '../lib/authNav';
import { loaders } from '../lib/preload';
import { cn } from '../lib/cn';
import s from './Auth.styles';

/**
 * 로그인 · 회원가입 · 비밀번호 찾기 화면의 틀. 860px 이하에서는 입력만 보인다.
 * - login: 왼쪽 브랜드 그림 / 오른쪽 입력 (비밀번호 찾기도 같은 배치)
 * - signup: 왼쪽 입력 / 오른쪽 브랜드 그림
 * 로그인 ↔ 회원가입으로 바꿀 때: 카드 전체가 양 끝에서 가운데로 접혀 사라졌다가(collapse) → 안 보일 때 두 판이 바뀌고(swap)
 *   → 가운데에서 다시 펼쳐진다(expand) (global.css)
 */
export function AuthShell({
  variant = 'login',
  step,
  title,
  desc,
  switchText,
  switchLink,
  switchTo,
  onBack,
  onSubmit,
  children,
  after,
}: {
  variant?: 'login' | 'signup';
  /** 회원가입 단계 표시 (예: "1 / 2 · 정보 입력") */
  step?: string;
  title: ReactNode;
  desc?: ReactNode;
  /** 주 버튼 아래: "이미 회원이신가요? 로그인" */
  switchText?: string;
  switchLink?: string;
  switchTo?: string;
  /** 왼쪽 위 ← 버튼. 없으면 브라우저 뒤로 가기 */
  onBack?: () => void;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  /** 맨 아래 덧붙일 내용 (예: 개발용 체험 계정 안내) */
  after?: ReactNode;
}) {
  const navigate = useNavigate();
  const authState = useAuthState();
  // 반대쪽 화면(로그인 ↔ 회원가입) 코드를 미리 받아 두어 바로 넘어가게 한다
  useEffect(() => {
    void loaders.login();
    void loaders.signup();
  }, []);
  const brand = variant === 'login' ? <LoginBrand /> : <SignupBrand />;
  return (
    <main className={s.page}>
      <div className={cn(s.card, 'auth-card')}>
        {variant === 'login' && brand}
        <form className={s.formPane} onSubmit={onSubmit} noValidate>
          <div className={s.top}>
            <button
              type="button"
              className={s.back}
              aria-label="뒤로 가기"
              onClick={onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate('/')))}
            >
              <BackIcon className="w-5 h-5" />
            </button>
            {step && <span className={s.step}>{step}</span>}
          </div>
          <div className={s.body}>
            <h1 className={s.title}>{title}</h1>
            {desc && <p className={s.desc}>{desc}</p>}
            {children}
            {/* 주 버튼 바로 아래: "처음이신가요? 회원가입" */}
            {switchTo && (
              <p className={s.switch}>
                {switchText}
                {/* 돌아갈 곳(from)은 주소가 아니라 state 로 그대로 넘긴다 → 주소는 /login, /signup 그대로 */}
                <Link
                  to={switchTo}
                  replace
                  state={authState}
                  viewTransition
                  className={s.switchLink}
                >
                  {switchLink}
                </Link>
              </p>
            )}
            {after}
          </div>
        </form>
        {variant === 'signup' && brand}
      </div>
    </main>
  );
}

/** 로그인 쪽 그림: 루프에서 보게 될 화면(인기 글, 팔로우한 채널)을 카드로 미리 보여 준다. 장식이라 스크린 리더에는 숨김 */
function LoginBrand() {
  return (
    <aside className={cn(s.brand, s.brandLogin)} aria-hidden>
      <div className={s.brandShapeA} />
      <div className={s.brandShapeB} />
      <div className={s.brandHead}>
        <LogoMark className="w-9 h-9" inverted />
        <p className={s.brandTitle}>
          가볍게 이야기 나누는
          <br />
          우리들의 고리, 루프
        </p>
      </div>
      <div className={cn(s.floatCard, s.popularCard)}>
        <span className={s.floatLabel}>지금 인기 있는 글</span>
        {['첫 월급 관리 어떻게 하셨어요?', '3개월째 아침 운동 성공 중', '자취 필수템 정리'].map((t, i) => (
          <span key={t} className={s.rankRow}>
            <b className={s.rankNo}>{i + 1}</b>
            {t}
          </span>
        ))}
      </div>
      <div className={cn(s.floatCard, s.channelCard)}>
        <span className={s.floatLabel}>팔로우한 채널</span>
        <span className={s.chips}>
          {[
            ['일', '일상', '#03b26c'],
            ['재', '재테크', '#3182f6'],
            ['개', '개발', '#00b8d9'],
          ].map(([ch, name, color]) => (
            <span key={name} className={s.chip}>
              <span className={s.chipIcon} style={{ background: color }}>
                {ch}
              </span>
              {name}
            </span>
          ))}
        </span>
      </div>
      <div className={cn(s.bubble, s.bubbleA)}>💬</div>
      <div className={cn(s.bubble, s.bubbleB)}>❤️</div>
    </aside>
  );
}

/** 회원가입 쪽 그림: 가입하면 할 수 있는 것과 안전하게 지키는 방법 */
function SignupBrand() {
  return (
    <aside className={cn(s.brand, s.brandSignup)} aria-hidden>
      <div className={s.brandShapeC} />
      <div className={s.brandShapeD} />
      <div className={s.brandHead}>
        <LogoMark className="w-9 h-9" inverted />
        <p className={s.brandTitle}>
          지금 가입하고
          <br />
          나만의 고리를 만들어 보세요
        </p>
      </div>
      <div className={cn(s.floatCard, s.benefitCard)}>
        <span className={cn(s.floatLabel, 'text-[#6b5cf6]')}>가입하면 할 수 있어요</span>
        {['관심 있는 채널 팔로우', '글과 댓글로 함께 이야기', '나만의 채널 만들기'].map((t) => (
          <span key={t} className={s.benefitRow}>
            <span className={s.benefitCheck}>✓</span>
            {t}
          </span>
        ))}
      </div>
      <div className={cn(s.floatCard, s.safeCard)}>
        <span className={s.safeIcon}>🔒</span>
        <span className={s.safeTitle}>내 계정은 안전하게</span>
        <span className={s.safeDesc}>이메일 인증과 2단계 인증으로 지켜요</span>
      </div>
      <div className={cn(s.bubble, s.bubbleC)}>✨</div>
      <div className={cn(s.bubble, s.bubbleD)}>🎉</div>
    </aside>
  );
}

/**
 * 밑줄형 입력칸. 왼쪽 아이콘, 오른쪽엔 맞으면 ✓ / 비밀번호면 눈 아이콘.
 * error 가 있으면 빨간 밑줄 + 아이콘 + 왼쪽 아래 메시지, shake 가 바뀌면 칸을 살짝 흔든다.
 * aside 는 오른쪽 아래 (예: 비밀번호 찾기).
 */
export function AuthField({
  icon,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  invalid,
  valid,
  aside,
  hint,
  hintLines = 1,
  shake,
  autoComplete,
  autoFocus,
  maxLength,
}: {
  icon: ReactNode;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  /** 메시지 없이 칸만 빨갛게 (예: 로그인 실패 때 이메일 칸) */
  invalid?: boolean;
  valid?: boolean;
  aside?: ReactNode;
  /** 오류가 없을 때 같은 자리에 보여 줄 안내 (예: 비밀번호 조건) */
  hint?: ReactNode;
  /** 안내 자리 줄 수 (비밀번호 조건처럼 두 줄이면 2). 오류가 떠도 높이는 이만큼으로 고정 */
  hintLines?: 1 | 2;
  shake?: number;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const bad = !!error || !!invalid;
  const rowRef = useRef<HTMLDivElement>(null);
  // 오류가 새로 생기거나 다시 제출할 때마다 칸을 살짝 흔든다.
  // (key 로 다시 그리면 input 이 새로 생기면서 autoFocus 가 포커스를 뺏으므로 Web Animations 로 흔든다)
  useEffect(() => {
    if (!bad || !shake) return;
    rowRef.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-in-out' },
    );
  }, [bad, shake, error]);
  return (
    <div className={s.field}>
      <div ref={rowRef} className={cn(s.inputRow, bad && s.inputRowError)}>
        <span className={cn(s.icon, bad && 'text-danger')}>{icon}</span>
        <input
          id={id}
          className={s.input}
          type={isPassword && reveal ? 'text' : type}
          placeholder={label}
          aria-label={label}
          aria-invalid={bad}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // 아무것도 안 쓰고 지나간 칸은 '입력해 주세요'를 제출할 때까지 미룬다
          onBlur={value ? onBlur : undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          spellCheck={false}
          autoCapitalize="off"
        />
        {valid && !bad && <CheckCircleIcon className={s.validIcon} aria-label="확인됨" />}
        {isPassword && (
          <button
            type="button"
            className={s.eye}
            aria-label={reveal ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={reveal}
            onClick={() => setReveal((v) => !v)}
          >
            {reveal ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        )}
      </div>
      <div className={cn(s.below, hintLines === 2 && s.belowTall)}>
        {error ? (
          <p id={`${id}-error`} className={s.error} role="alert" title={error}>
            <AlertCircleIcon className="flex-none w-4 h-4" />
            <span>{error}</span>
          </p>
        ) : (
          (hint ?? <span />)
        )}
        {aside}
      </div>
    </div>
  );
}

/** 비밀번호 조건 목록: 맞으면 초록 ✓ */
export function PasswordRules({ rules }: { rules: { label: string; ok: boolean }[] }) {
  return (
    <ul className={s.rules}>
      {rules.map((r) => (
        <li key={r.label} className={cn(s.rule, r.ok && s.ruleOk)}>
          {r.ok ? <CheckCircleIcon className="w-4 h-4" /> : <span className={s.ruleDot} />}
          {r.label}
        </li>
      ))}
    </ul>
  );
}

/** 알약 모양 주 버튼. 마우스를 올리면 유리처럼 빛나는 효과 (global.css 의 .glass-button) */
export function AuthSubmit({ children, pending, disabled }: { children: ReactNode; pending?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" className={cn(s.submit, 'glass-button')} disabled={pending || disabled}>
      {pending && <span className={s.spinner} />}
      <span className={s.submitLabel}>{children}</span>
    </button>
  );
}

/**
 * 입력칸 검사 표시 시점: 한 번 벗어난 칸(blur)이나, 제출을 눌러 본 뒤에만 오류를 보여 준다.
 * (처음 입력하는 동안 빨간 글씨가 뜨지 않게)
 */
export function useFieldCheck<K extends string>(errors: Partial<Record<K, string>>) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [attempt, setAttempt] = useState(0);
  return {
    /** 지금 보여 줄 오류 */
    error: (k: K) => (touched[k] || attempt > 0 ? errors[k] : undefined),
    blur: (k: K) => () => setTouched((t) => ({ ...t, [k]: true })),
    /** 칸을 흔들 때 쓰는 값 (제출할 때마다 바뀐다) */
    attempt,
    /** 제출: 오류가 없으면 true. 있으면 모든 칸에 오류를 보여 주고 흔든다 */
    submit: () => {
      setAttempt((n) => n + 1);
      return Object.values(errors).every((v) => !v);
    },
    reset: () => (setTouched({}), setAttempt(0)),
  };
}

export { s as authStyles };
