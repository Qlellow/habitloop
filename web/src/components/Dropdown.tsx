import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import s from './Dropdown.styles';

export interface DropdownOption<T> {
  value: T;
  label: string;
  /** 옵션 오른쪽에 붙는 작은 설명 (예: 운영진 전용) */
  hint?: ReactNode;
}

/**
 * 드롭다운 메뉴 (select 대체). 버튼을 눌러야 목록이 펼쳐진다.
 * 키보드: ↑/↓ 이동, Enter/Space 선택, Esc 닫기, Home/End 처음/끝. 바깥을 클릭해도 닫힌다.
 */
export function Dropdown<T>({
  value,
  options,
  onChange,
  placeholder = '선택',
  label,
  className,
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openMenu = () => {
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const selected = options[selectedIndex];

  return (
    <div className={cn(s.root, className)} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={s.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className={selected ? s.value : s.placeholder}>{selected?.label ?? placeholder}</span>
        <svg className={s.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className={s.menu} role="listbox" id={listId} aria-label={label} aria-activedescendant={`${listId}-${active}`}>
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              className={cn(s.option, i === active && s.active)}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // 포커스가 버튼에서 빠지지 않게
              onClick={() => choose(i)}
            >
              <span className={s.optionLabel}>{o.label}</span>
              {o.hint}
              {i === selectedIndex && (
                <svg className={s.check} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
