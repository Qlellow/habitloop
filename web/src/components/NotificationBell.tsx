import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { timeAgo, useNotifications, useReadNotifications, useUnreadNotifications, type NotificationItem } from '@loop/shared';
import { BellIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { ui } from './ui';
import { cn } from '../lib/cn';

const name = (n: NotificationItem) => n.actor?.nickname ?? '알 수 없는 사용자';

/** 알림 한 줄의 문장 */
function message(n: NotificationItem) {
  const who = <b className="font-semibold text-fg-strong">{name(n)}</b>;
  switch (n.type) {
    case 'comment':
      return <>{who}님이 내 글에 댓글을 달았어요</>;
    case 'reply':
      return <>{who}님이 내 댓글에 답글을 달았어요</>;
    case 'like':
      return n.count > 1 ? (
        <>
          {who}님 외 {(n.count - 1).toLocaleString()}명이 내 글에 공감했어요
        </>
      ) : (
        <>{who}님이 내 글에 공감했어요</>
      );
    case 'notice':
      return (
        <>
          <b className="font-semibold text-fg-strong">{n.post.channelName}</b>에 새 공지가 올라왔어요
        </>
      );
  }
}

/**
 * 헤더의 알림 종. 안 읽은 알림이 있으면 빨간 점(숫자)이 뜨고, 누르면 알림 목록이 열린다.
 * 알림을 누르면 읽음으로 바꾸고 그 글로 간다.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useUnreadNotifications().data?.count ?? 0;
  const list = useNotifications(open);
  const read = useReadNotifications();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => setOpen(false), [pathname]);
  // 열 때마다 최신 알림으로
  useEffect(() => {
    if (open) void list.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (n: NotificationItem) => {
    if (!n.read) read.mutate(n.id);
    setOpen(false);
    navigate(`/posts/${n.post.id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={cn(
          'relative grid place-items-center w-10 h-10 rounded-md text-fg-sub transition-colors hover:bg-field hover:text-fg-strong',
          'aria-expanded:bg-field aria-expanded:text-fg-strong',
        )}
        aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : '알림'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon width={22} height={22} />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[11px] font-bold leading-none ring-2 ring-surface tabular-nums"
            aria-hidden
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="알림"
          className={cn(
            'absolute right-0 top-[calc(100%+8px)] w-[380px] flex flex-col rounded-md border border-border bg-surface shadow-pop animate-pop',
            'max-h-[min(560px,calc(100dvh-96px))]',
            // 폰: 화면 폭에 맞춘다
            'max-[520px]:fixed max-[520px]:top-[calc(64px+4px)] max-[520px]:inset-x-3 max-[520px]:w-auto',
          )}
        >
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line">
            <h2 className="m-0 text-base font-bold text-fg-strong">알림</h2>
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small, 'px-2')}
              disabled={unread === 0 || read.isPending}
              onClick={() => read.mutate(undefined)}
            >
              모두 읽음
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {list.isPending ? (
              <div className={cn(ui.spinner, 'my-8')} />
            ) : items.length === 0 ? (
              <p className={cn(ui.empty, 'py-10')}>아직 알림이 없어요</p>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={cn(
                        'w-full flex gap-3 px-2.5 py-2.5 rounded-sm text-left transition-colors hover:bg-field',
                        !n.read && 'bg-primary-weak',
                      )}
                    >
                      <UserAvatar nickname={n.type === 'notice' ? n.post.channelName : name(n)} avatarUrl={n.actor?.avatarUrl} size={36} className="mt-0.5" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] leading-[1.45] text-fg">{message(n)}</span>
                        {n.comment && <span className="block mt-0.5 text-[13px] text-fg-sub truncate">“{n.comment.excerpt}”</span>}
                        <span className="block mt-0.5 text-[12px] text-fg-weak truncate">
                          {n.post.title} · {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.read && <span className="flex-none mt-2 w-2 h-2 rounded-full bg-primary" aria-label="안 읽음" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.hasNextPage && (
              <button
                type="button"
                className={cn(ui.button, ui.ghost, ui.full, ui.small, 'mt-1')}
                disabled={list.isFetchingNextPage}
                onClick={() => list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
