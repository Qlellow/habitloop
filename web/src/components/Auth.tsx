import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { compact, passwordStrength, useChannels, usePopular } from '@loop/shared';
import { ChannelIcon } from './ChannelIcon';
import { AlertCircleIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from './Icons';
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
  switchTransition = true,
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
  /** 접혔다 펼쳐지는 전환 애니메이션을 쓸지 (로그인 ↔ 회원가입만. 비밀번호 찾기 → 로그인은 바로 바꾼다) */
  switchTransition?: boolean;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  /** 맨 아래 덧붙일 내용 (예: 개발용 체험 계정 안내) */
  after?: ReactNode;
}) {
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
          {step && (
            <div className={s.top}>
              <span className={s.step}>{step}</span>
            </div>
          )}
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
                  viewTransition={switchTransition}
                  onClick={switchTransition ? markAuthSwap : undefined}
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

/** 전환 링크를 누를 때만 카드 전환 애니메이션을 켠다 (global.css). 전환이 끝나면 끈다 */
function markAuthSwap() {
  const root = document.documentElement;
  root.dataset.authSwap = '';
  window.setTimeout(() => delete root.dataset.authSwap, 1500);
}

/** 로그인 쪽 그림: 지금 루프의 실제 인기 글 3개와 인기 채널 TOP3 를 카드로 보여 준다. 장식이라 스크린 리더에는 숨김 */
function LoginBrand() {
  const { data: popular } = usePopular();
  const { data: channels } = useChannels();
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
        {popular
          ? popular.slice(0, 3).map((p, i) => (
              <span key={p.id} className={s.rankRow}>
                <b className={s.rankNo}>{i + 1}</b>
                <span className="truncate">{p.title}</span>
              </span>
            ))
          : [0, 1, 2].map((i) => <span key={i} className={s.rankSkeleton} />)}
      </div>
      <div className={cn(s.floatCard, s.channelCard)}>
        <span className={s.floatLabel}>인기 TOP3 채널</span>
        <span className={s.chips}>
          {channels
            ? channels.slice(0, 3).map((c) => (
                <span key={c.slug} className={s.chip}>
                  <ChannelIcon channel={c} size={24} />
                  {c.name}
                  <span className={s.chipMeta}>{compact(c.memberCount)}</span>
                </span>
              ))
            : [0, 1, 2].map((i) => <span key={i} className={s.chipSkeleton} />)}
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
        {/* 포커스되면 아이콘도 밑줄과 같은 색으로 (아이콘은 바로 바뀐다) */}
        <span className={cn(s.icon, bad && s.iconError)}>{icon}</span>
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

/**
 * 비밀번호 강도 막대: 약함 · 보통 · 강함 · 매우 강함 (4칸). '강함' 이상이어야 쓸 수 있다.
 * 아래 줄에는 강도 이름과, 모자란 조건(8자 이상 · 숫자 · 특수문자)이 있으면 그것만 짧게 알려 준다.
 */
export function PasswordStrength({ value }: { value: string }) {
  const { level, label, missing } = passwordStrength(value);
  const bar = ['', s.barWeak, s.barFair, s.barStrong, s.barVeryStrong][level];
  const text = ['', s.textWeak, s.textFair, s.textStrong, s.textVeryStrong][level];
  // 모자란 조건만 짧게: "숫자 · 특수문자가 필요해요" (마지막 말에 따라 이/가)
  const last = missing[missing.length - 1];
  const message = !value
    ? '8자 이상, 숫자와 특수문자를 넣어 주세요'
    : missing.length > 0
      ? `${missing.join(' · ')}${last === '8자 이상' ? '이' : '가'} 필요해요`
      : level === 3
        ? '사용할 수 있어요. 12자 이상이나 대·소문자를 섞으면 더 안전해요'
        : '아주 안전한 비밀번호예요';
  return (
    <div className={s.meterWrap}>
      <div className={s.meter} role="meter" aria-label="비밀번호 강도" aria-valuemin={0} aria-valuemax={4} aria-valuenow={level} aria-valuetext={label || '없음'}>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn(s.meterBar, n <= level && bar)} />
        ))}
      </div>
      <p className={s.meterText}>
        {label && <b className={cn(s.meterLabel, text)}>{label}</b>}
        <span className="truncate">{message}</span>
      </p>
    </div>
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
