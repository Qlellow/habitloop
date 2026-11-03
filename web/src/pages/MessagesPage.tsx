import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, isUserId, timeAgo, useDmConversation, useDmThreads, useLeaveDm, useSendDm } from '@loop/shared';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { ask } from '../components/ConfirmHost';
import { cn } from '../lib/cn';
import { useMediaQuery } from '../lib/media';
import { usePageTitle } from '../lib/title';

/**
 * 1:1 쪽지: 왼쪽 대화 목록 + 오른쪽 대화 (좁은 화면은 하나씩).
 * 보는 동안 몇 초마다 새 쪽지를 확인한다 (shared 의 refetchInterval)
 */
function Threads({ current }: { current?: string }) {
  const threads = useDmThreads();
  if (threads.isPending) return <div className={ui.spinner} />;
  if (!threads.data?.length) {
    return <p className="m-0 px-5 py-10 text-center text-sm text-fg-weak">아직 주고받은 쪽지가 없어요. 프로필에서 '쪽지'를 눌러 시작해 보세요.</p>;
  }
  return (
    <ul className="list-none m-0 p-2">
      {threads.data.map((t) => (
        <li key={t.user.id}>
          <Link
            to={`/messages/${t.user.id}`}
            replace={!!current}
            aria-current={current === t.user.id ? 'page' : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-field aria-[current=page]:bg-primary-weak"
          >
            <UserAvatar nickname={t.user.nickname} avatarUrl={t.user.avatarUrl} size={40} />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline gap-2">
                <b className="truncate text-[15px] text-fg-strong">{t.user.nickname}</b>
                <span className="ml-auto flex-none text-[12px] text-fg-weak">{timeAgo(t.lastAt)}</span>
              </span>
              <span className={cn('block truncate text-[13px]', t.unread ? 'text-fg-strong font-semibold' : 'text-fg-sub')}>
                {t.lastMine && '나: '}
                {t.last}
              </span>
            </span>
            {t.unread > 0 && (
              <span className="flex-none min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full bg-primary text-white text-[11px] font-bold">
                {t.unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Conversation({ userId }: { userId: string }) {
  const convo = useDmConversation(userId);
  const send = useSendDm(userId);
  const leave = useLeaveDm();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const first = convo.data?.pages[0];
  usePageTitle(first ? `${first.user.nickname}님과의 쪽지` : undefined);
  // 오래된 것 → 최근 순서로 (서버는 최근 것부터 준다)
  const messages = (convo.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse();
  const newest = messages[messages.length - 1]?.id;

  // 열어 본 쪽지는 서버가 읽음으로 바꾸니, 헤더 숫자 · 대화 목록을 다시 센다
  const qc = useQueryClient();
  useEffect(() => {
    if (newest == null) return;
    void qc.invalidateQueries({ queryKey: ['dms', 'unread'] });
    void qc.invalidateQueries({ queryKey: ['dms'], exact: true });
  }, [newest, qc]);

  // 새 쪽지가 오면 맨 아래로
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newest]);

  if (convo.error instanceof ApiError) return <p className="m-0 p-8 text-center text-sm text-fg-sub">{convo.error.message}</p>;
  if (!first) return <div className={ui.spinner} />;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || send.isPending) return;
    send.mutate(content, { onSuccess: () => setText(''), onError: (err) => toast(err.message) });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to="/messages" className={cn(ui.button, ui.text, ui.small, 'px-2 min-[860px]:hidden')} aria-label="대화 목록">
          ‹
        </Link>
        <Link to={`/u/${first.user.id}`} className="flex items-center gap-2.5 min-w-0">
          <UserAvatar nickname={first.user.nickname} avatarUrl={first.user.avatarUrl} size={32} />
          <h1 className="m-0 truncate text-[16px] font-bold text-fg-strong">{first.user.nickname}</h1>
        </Link>
        <button
          type="button"
          className={cn(ui.button, ui.text, ui.small, 'ml-auto')}
          onClick={async () => {
            if (
              !(await ask('대화방을 나갈까요?', {
                message: '내 쪽에서만 지금까지의 쪽지가 지워져요. 상대가 다시 보내면 새로 시작돼요.',
                confirmLabel: '나가기',
                danger: true,
              }))
            )
              return;
            leave.mutate(userId, { onSuccess: () => navigate('/messages', { replace: true }), onError: (err) => toast(err.message) });
          }}
        >
          나가기
        </button>
      </div>
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2" aria-live="polite">
        {convo.hasNextPage && (
          <button
            type="button"
            className={cn(ui.button, ui.ghost, ui.small, 'self-center')}
            disabled={convo.isFetchingNextPage}
            onClick={() => void convo.fetchNextPage()}
          >
            이전 쪽지 더 보기
          </button>
        )}
        {!messages.length && <p className="m-auto text-sm text-fg-weak">첫 쪽지를 보내 보세요</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn('dm-bubble', m.mine && 'is-mine')}>
            <p>{m.content}</p>
            <time dateTime={m.createdAt}>
              {timeAgo(m.createdAt)}
              {m.mine && !m.read && ' · 안 읽음'}
            </time>
          </div>
        ))}
      </div>
      {first.canSend ? (
        <form className="flex items-end gap-2 px-4 py-3 border-t border-border" onSubmit={submit}>
          <textarea
            className={cn(ui.textarea, 'min-h-[44px] max-h-40 py-2.5 resize-none')}
            rows={1}
            maxLength={1000}
            placeholder="쪽지 보내기"
            title="Enter 로 보내기, Shift+Enter 줄바꿈"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            aria-label="쪽지 내용"
          />
          <button type="submit" className={cn(ui.button, ui.primary)} disabled={!text.trim() || send.isPending}>
            보내기
          </button>
        </form>
      ) : (
        <p className="m-0 px-4 py-4 border-t border-border text-center text-sm text-fg-weak">{first.reason ?? '쪽지를 보낼 수 없어요'}</p>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { id } = useParams();
  const wide = useMediaQuery('(min-width: 860px)');
  const valid = id && isUserId(id) ? id : undefined;
  useEffect(() => {
    if (id && !valid) toast('없는 대화예요');
  }, [id, valid]);
  return (
    <Page variant="single">
      <section className={cn(ui.card, 'dm-layout')}>
        {(wide || !valid) && (
          <aside className="dm-threads">
            {/* 대화를 열었으면 제목(h1)은 상대 이름 */}
            {valid ? <h2 className="m-0 px-5 pt-4 pb-1 text-[17px] font-bold text-fg-strong">쪽지</h2> : <h1 className="m-0 px-5 pt-4 pb-1 text-[17px] font-bold text-fg-strong">쪽지</h1>}
            <Threads current={valid} />
          </aside>
        )}
        {valid ? (
          <Conversation key={valid} userId={valid} />
        ) : (
          wide && <div className="grid place-items-center text-sm text-fg-weak">왼쪽에서 대화를 고르세요</div>
        )}
      </section>
    </Page>
  );
}
