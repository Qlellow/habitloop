import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, ArrowRightIcon, BackIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from './Icons';
import { LogoMark } from './Layout';
import { cn } from '../lib/cn';
import s from './Auth.styles';

/**
 * 로그인 · 회원가입 · 비밀번호 찾기 화면의 틀.
 * 넓은 화면: 왼쪽 입력 / 오른쪽 브랜드 그림. 860px 이하: 입력만.
 */
export function AuthShell({
  title,
  desc,
  switchText,
  switchLink,
  switchTo,
  onBack,
  onSubmit,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  /** 오른쪽 위: "이미 회원이신가요? 로그인" */
  switchText?: string;
  switchLink?: string;
  switchTo?: string;
  /** 왼쪽 위 ← 버튼. 없으면 브라우저 뒤로 가기 */
  onBack?: () => void;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <main className={s.page}>
      <div className={s.card}>
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
            {switchTo && (
              <p className={s.switch}>
                {switchText}
                <Link to={switchTo} replace className={s.switchLink}>
                  {switchLink}
                </Link>
              </p>
            )}
          </div>
          <div className={s.body}>
            <h1 className={s.title}>{title}</h1>
            {desc && <p className={s.desc}>{desc}</p>}
            {children}
          </div>
        </form>
        <BrandPanel />
      </div>
    </main>
  );
}

/** 오른쪽 브랜드 그림: 루프에서 보게 될 화면을 카드 몇 장으로 미리 보여 준다 (장식이라 스크린 리더에는 숨김) */
function BrandPanel() {
  return (
    <aside className={s.brand} aria-hidden>
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
  /** 입력칸 아래 안내 (예: 비밀번호 조건) */
  hint?: ReactNode;
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
          onBlur={onBlur}
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
      {(error || aside) && (
        <div className={s.below}>
          {error ? (
            <p id={`${id}-error`} className={s.error} role="alert">
              <AlertCircleIcon className="flex-none w-4 h-4" />
              {error}
            </p>
          ) : (
            <span />
          )}
          {aside}
        </div>
      )}
      {hint}
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

/** 알약 모양 주 버튼 + 오른쪽 화살표 */
export function AuthSubmit({ children, pending, disabled }: { children: ReactNode; pending?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" className={s.submit} disabled={pending || disabled}>
      <span className="flex-1 text-center">{children}</span>
      <span className={s.submitArrow}>{pending ? <span className={s.spinner} /> : <ArrowRightIcon className="w-4 h-4" />}</span>
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
