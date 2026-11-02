import { Link, useLocation } from 'react-router-dom';
import { useDmUnread } from '@loop/shared';
import { MailLineIcon } from './Icons';
import { preload } from '../lib/preload';
import { cn } from '../lib/cn';

/** 헤더의 쪽지 버튼: 안 읽은 쪽지가 있으면 숫자 */
export function MessagesLink() {
  const { data: unread = 0 } = useDmUnread();
  const here = useLocation().pathname.startsWith('/messages');
  return (
    <Link
      to="/messages"
      className={cn(
        'relative grid place-items-center w-10 h-10 rounded-md text-fg-sub transition-colors hover:bg-field hover:text-fg-strong',
        here && 'bg-field text-fg-strong',
      )}
      aria-label={unread > 0 ? `쪽지 ${unread}개 안 읽음` : '쪽지'}
      onPointerEnter={preload.messages}
      draggable={false}
    >
      <MailLineIcon width={22} height={22} />
      {unread > 0 && (
        <span
          className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[11px] font-bold leading-none ring-2 ring-surface tabular-nums"
          aria-hidden
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
