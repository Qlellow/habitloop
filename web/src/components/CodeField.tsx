import { useEffect, useState } from 'react';
import { CODE_LENGTH, CODE_TTL_SECONDS, cleanCode, mmss } from '@loop/shared';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 인증번호를 다시 받을 수 있을 때까지 남은 초 (서버도 60초 간격을 지킨다) */
export function useCooldown(seconds = 60, startRunning = false) {
  const [until, setUntil] = useState(() => (startRunning ? Date.now() + seconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until, now]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return { left, start: () => (setNow(Date.now()), setUntil(Date.now() + seconds * 1000)) };
}

/** 번호를 보낸 뒤: 만료까지 남은 시간(5분)과 다시 받기까지 남은 시간(60초)을 함께 센다 */
export function useCodeTimer(startRunning = false) {
  const expiry = useCooldown(CODE_TTL_SECONDS, startRunning);
  const resend = useCooldown(60, startRunning);
  return {
    expiresLeft: expiry.left,
    expired: expiry.left === 0,
    resendLeft: resend.left,
    restart: () => (expiry.start(), resend.start()),
  };
}

/**
 * 6칸으로 나뉜 인증번호 입력칸 (영문 대문자 + 1~9).
 * 실제 입력은 칸 위에 투명하게 겹친 input 하나가 받으므로 붙여넣기·휴대폰 자동 완성·지우기가 그대로 된다.
 * 소문자로 쳐도 대문자로 바뀐다.
 */
export function CodeField({
  value,
  onChange,
  autoFocus,
  label = '인증번호',
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  label?: string;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className="relative">
      <div className="flex justify-center gap-2 max-[380px]:gap-1.5" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              'flex items-center justify-center w-12 h-14 rounded-md border-2 bg-field text-2xl font-bold text-fg-strong transition-colors',
              'max-[380px]:w-10 max-[380px]:h-12 max-[380px]:text-xl',
              invalid ? 'border-danger' : focused && i === active ? 'border-primary bg-surface' : 'border-transparent',
            )}
          >
            {value[i] ?? ''}
          </span>
        ))}
      </div>
      <input
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={CODE_LENGTH}
        aria-label={`${label} ${CODE_LENGTH}자리`}
        value={value}
        onChange={(e) => onChange(cleanCode(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
      />
    </div>
  );
}

/** 입력칸 아래: 남은 시간 + 번호 다시 받기 */
export function CodeTimer({
  timer,
  onResend,
  pending,
}: {
  timer: ReturnType<typeof useCodeTimer>;
  onResend: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mt-2.5 text-[13px]">
      {timer.expired ? (
        <span className="text-danger font-semibold">시간이 지났어요. 번호를 다시 받아 주세요</span>
      ) : (
        <span className="text-fg-sub">
          남은 시간 <b className="text-primary tabular-nums">{mmss(timer.expiresLeft)}</b>
        </span>
      )}
      <button
        type="button"
        className={cn(ui.button, ui.text, ui.small)}
        disabled={timer.resendLeft > 0 || pending}
        onClick={onResend}
      >
        {pending ? '보내는 중…' : timer.resendLeft > 0 ? `다시 받기 (${timer.resendLeft}초)` : '인증번호 다시 받기'}
      </button>
    </div>
  );
}
