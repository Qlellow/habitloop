import { useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useUserSearch } from '@loop/shared';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/cn';

/**
 * @멘션: 댓글에 @닉네임 을 쓰면 그 사람에게 알림이 간다 (서버 notifications.mentioned).
 *  - useMention: 입력칸에서 @ 뒤를 치면 닉네임 후보를 띄우고, ↑↓ · Enter · Tab 으로 고른다
 *  - withMentions: 보여 줄 때 @닉네임 을 강조한다
 */

/** 커서 바로 앞의 @단어 (공백 · 줄바꿈 뒤나 맨 앞의 @ 만) */
function tokenAt(text: string, caret: number) {
  const m = /(^|\s)@([^\s@]{0,20})$/.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, q: m[2] } : undefined;
}

export function useMention(text: string, setText: (v: string) => void, ref: RefObject<HTMLTextAreaElement | null>) {
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState<number>();
  const token = tokenAt(text, caret);
  const search = useUserSearch(token && token.q.length > 0 && closed !== token.start ? token.q : '');
  const list = token && token.q && closed !== token.start ? (search.data ?? []).slice(0, 6) : [];
  const open = list.length > 0;

  const pick = (nickname: string) => {
    if (!token) return;
    const next = `${text.slice(0, token.start)}@${nickname} ${text.slice(caret)}`;
    const at = token.start + nickname.length + 2;
    setText(next);
    setCaret(at);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, at);
    });
  };

  /** 입력칸의 onKeyDown 앞에서 부른다. 후보를 다뤘으면 true */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
      return true;
    }
    if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault();
      pick(list[Math.min(active, list.length - 1)].nickname);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setClosed(token?.start);
      return true;
    }
    return false;
  };

  /** 입력칸의 커서가 움직일 때 (onChange · onSelect · onClick) */
  const track = () => {
    setCaret(ref.current?.selectionStart ?? 0);
    setActive(0);
  };

  const popup = open ? (
    <ul className="mention-list" role="listbox" aria-label="부를 사람">
      {list.map((u, i) => (
        <li key={u.id} role="option" aria-selected={i === active}>
          <button
            type="button"
            className={cn(i === active && 'is-active')}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pick(u.nickname)}
            onPointerEnter={() => setActive(i)}
          >
            <UserAvatar nickname={u.nickname} avatarUrl={u.avatarUrl} size={24} />@{u.nickname}
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return { onKeyDown, track, popup };
}

/** 글자 안의 @닉네임 을 강조 (공백 · 줄 맨 앞의 @ 만) */
export function withMentions(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/(^|\s)(@[^\s@]{2,20})/g)) {
    const at = m.index! + m[1].length;
    out.push(text.slice(last, at));
    out.push(
      <span key={at} className="mention">
        {m[2]}
      </span>,
    );
    last = at + m[2].length;
  }
  out.push(text.slice(last));
  return out;
}
