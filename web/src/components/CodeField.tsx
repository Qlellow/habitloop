import { useEffect, useState } from 'react';
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

/**
 * 6자리 인증번호 입력칸. 숫자 키패드가 뜨고, 휴대폰에서는 문자·메일로 온 번호를 자동 완성으로 넣을 수 있다.
 */
export function CodeField({
  value,
  onChange,
  autoFocus,
  label = '인증번호',
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  label?: string;
}) {
  return (
    <input
      className={cn(ui.input, 'text-center text-xl font-bold tracking-[0.5em] placeholder:tracking-normal placeholder:text-[15px] placeholder:font-normal')}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="숫자 6자리"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      autoFocus={autoFocus}
    />
  );
}
