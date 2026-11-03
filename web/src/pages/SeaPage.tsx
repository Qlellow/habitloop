import { useState, type FormEvent } from 'react';
import {
  timeAgo,
  useBottleAction,
  useBottleConversations,
  useMyBottles,
  useSea,
  useSendLetter,
  useThrowBottle,
  type BottleHopAction,
  type BottleLetter,
  type MyBottle,
} from '@loop/shared';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';

/**
 * 메시지 표류병 (바다): 병에 말을 담아 띄우면 무작위 누군가에게 닿는다.
 * 주운 병에는 답장하고 다시 띄우거나, 그냥 다시 흘려보낸다. 열 명을 거치면 해변에 닿아 여정을 마친다.
 * 서로 누군지 모른다. 바다를 보러 올 때마다 (손이 비어 있으면) 떠내려온 병을 하나 줍는다 (하루 3개)
 */

const MAX = 300;
const STATUS: Record<MyBottle['status'], string> = { drifting: '떠다니는 중', held: '누군가 읽는 중', ashore: '해변에 닿았어요' };
const ACTION: Record<BottleHopAction, string> = { reply: '답장했어요', release: '다시 띄웠어요', timeout: '그냥 지나쳤어요' };

/** 물결 위에서 까딱이는 병 (안에 돌돌 만 쪽지) */
function SeaScene({ bottle = true }: { bottle?: boolean }) {
  return (
    <div className="sea-scene" aria-hidden>
      <div className="sea-sun" />
      {bottle && (
        <svg className="sea-bottle" viewBox="0 0 60 90">
          <rect x="24" y="4" width="12" height="9" rx="2" className="sea-cork" />
          <path d="M25 13h10v10l7 9v44a8 8 0 01-8 8H26a8 8 0 01-8-8V32l7-9z" className="sea-glass" />
          <rect x="24" y="40" width="12" height="30" rx="3" className="sea-note" />
          <path d="M26 46h8M26 51h8M26 56h6" className="sea-note-line" />
          <path d="M22 36c2-3 4-4 6-4" className="sea-shine" />
        </svg>
      )}
      <svg className="sea-wave sea-wave-back" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 30 Q 75 10 150 30 T 300 30 T 450 30 T 600 30 T 750 30 T 900 30 T 1050 30 T 1200 30 V60 H0z" />
      </svg>
      <svg className="sea-wave sea-wave-front" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 30 Q 75 50 150 30 T 300 30 T 450 30 T 600 30 T 750 30 T 900 30 T 1050 30 T 1200 30 V60 H0z" />
      </svg>
    </div>
  );
}

function Compose({ left, onDone }: { left: number; onDone: () => void }) {
  const [text, setText] = useState('');
  const throwIt = useThrowBottle();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    throwIt.mutate(text, {
      onSuccess: () => {
        toast('병을 바다에 띄웠어요. 누군가에게 닿기를!');
        setText('');
        onDone();
      },
      onError: (err) => toast(err.message),
    });
  };
  return (
    <form className="sea-letter sea-unfold" onSubmit={submit}>
      <label className="block text-[13px] font-semibold text-[#7a5b2e]" htmlFor="bottle-text">
        병에 담을 말 (누가 보냈는지는 알려지지 않아요)
      </label>
      <textarea
        id="bottle-text"
        className="sea-paper-input"
        value={text}
        maxLength={MAX}
        rows={5}
        autoFocus
        placeholder="요즘 마음에 남은 일, 낯선 누군가에게 하고 싶은 말…"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[12px] text-[#9a7b4e] tabular-nums">
          {text.length}/{MAX} · 오늘 {left}개 더 띄울 수 있어요
        </span>
        <button type="button" className={cn(ui.button, ui.ghost, ui.small, 'ml-auto')} onClick={onDone}>
          닫기
        </button>
        <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={text.trim().length < 5 || throwIt.isPending}>
          {throwIt.isPending ? '띄우는 중…' : '바다에 띄우기'}
        </button>
      </div>
    </form>
  );
}

/** 지금 손에 든 병: 답장하고 다시 띄우기 · 그냥 다시 띄우기 · 신고 */
function HeldLetter({ id, content, hops, releaseAt }: { id: number; content: string; hops: number; releaseAt: string }) {
  const [reply, setReply] = useState('');
  const [reporting, setReporting] = useState(false);
  const act = useBottleAction();
  const run = (action: 'reply' | 'release' | 'report', done: string) =>
    act.mutate({ id, action, content: reply }, { onSuccess: () => toast(done), onError: (err) => toast(err.message) });
  const hoursLeft = Math.max(1, Math.round((new Date(releaseAt).getTime() - Date.now()) / 3600_000));
  return (
    <article className="sea-letter sea-unfold" aria-label="주운 병의 쪽지">
      <div className="flex items-center gap-2 text-[12px] text-[#7a5c30]">
        <span>🍾 이 병을 주운 {hops}번째 사람이에요</span>
        <span className="ml-auto whitespace-nowrap">{hoursLeft}시간 뒤 바다로</span>
      </div>
      <p className="sea-letter-body">{content}</p>
      <textarea
        className="sea-paper-input"
        value={reply}
        maxLength={MAX}
        rows={3}
        placeholder="답장을 남기면 띄운 사람에게만 닿아요 (누가 썼는지는 몰라요)"
        onChange={(e) => setReply(e.target.value)}
        aria-label="답장"
      />
      <div className="sea-actions">
        <button type="button" className={cn(ui.button, ui.text, ui.small, 'text-fg-weak')} onClick={() => setReporting(true)}>
          신고
        </button>
        <span className="ml-auto" />
        <button
          type="button"
          className={cn(ui.button, ui.ghost, ui.small)}
          disabled={act.isPending}
          onClick={() => run('release', '병을 다시 바다에 띄웠어요')}
        >
          그냥 다시 띄우기
        </button>
        <button
          type="button"
          className={cn(ui.button, ui.primary, ui.small)}
          disabled={reply.trim().length < 2 || act.isPending}
          onClick={() => run('reply', '답장을 담아 다시 띄웠어요')}
        >
          답장하고 다시 띄우기
        </button>
      </div>
      <ConfirmDialog
        open={reporting}
        title="이 병을 신고할까요?"
        message="병은 바다로 돌아가고, 이 병을 띄운 사람의 병은 앞으로 받지 않아요. 신고가 모이면 병을 건져 내요."
        confirmLabel="신고"
        danger
        onConfirm={() => {
          setReporting(false);
          run('report', '신고했어요. 이 사람의 병은 더 오지 않아요');
        }}
        onClose={() => setReporting(false)}
      />
    </article>
  );
}

/** 병이 거쳐 간 길: 사람마다 점 하나 (한 일에 따라 색), 떠다니는 중이면 끝에 병 */
function Journey({ bottle }: { bottle: MyBottle }) {
  return (
    <div className="sea-journey" aria-label={`${bottle.hops}명을 거쳤어요`}>
      <span className="sea-journey-start" title="띄운 곳" />
      {bottle.journey.map((h, i) => (
        <span key={i} className={cn('sea-journey-dot', h.action && `is-${h.action}`)} title={`${timeAgo(h.at)} · ${h.action ? ACTION[h.action] : '읽는 중'}`} />
      ))}
      {bottle.status !== 'ashore' && <span className="sea-journey-bottle">🍾</span>}
      {bottle.status === 'ashore' && <span className="sea-journey-bottle">🏝️</span>}
    </div>
  );
}

/**
 * 답장에 이어 주고받는 편지 (병 주인 ↔ 답장한 사람). 서로 이름은 끝까지 모른다.
 * other: 상대를 부르는 말 (병 주인에게는 '어느 바닷가의 누군가', 답장한 사람에게는 '병을 띄운 사람')
 */
function Letters({
  replyId,
  first,
  letters,
  other,
  isNew,
}: {
  replyId: number;
  /** 대화의 첫 말: 답장 (병 주인에게는 상대가, 답장한 사람에게는 내가 쓴 것) */
  first: { content: string; createdAt: string; mine: boolean };
  letters: BottleLetter[];
  other: string;
  isNew?: boolean;
}) {
  const send = useSendLetter();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (content.length < 2) return toast('두 글자 이상 적어 주세요');
    send.mutate(
      { replyId, content },
      {
        onSuccess: () => {
          setText('');
          setOpen(false);
          toast('답글을 남겼어요');
        },
        onError: (err) => toast(err.message),
      },
    );
  };
  // 게시글 댓글처럼: 답장이 댓글, 이어 주고받은 편지는 그 아래 한 단계 들인 답글
  const who = (mine: boolean) => (mine ? '나' : other);
  const mark = (mine: boolean) => (mine ? '🙂' : other === '병을 띄운 사람' ? '🍾' : '🐚');
  const Head = ({ mine, at, small }: { mine: boolean; at: string; small?: boolean }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('sea-avatar', small && 'is-small')} aria-hidden>
        {mark(mine)}
      </span>
      <b className="font-semibold text-fg-strong">{who(mine)}</b>
      <time className="text-[13px] text-fg-weak" dateTime={at} title={new Date(at).toLocaleString()}>
        {timeAgo(at)}
      </time>
    </div>
  );
  return (
    <div className="sea-comment">
      <Head mine={first.mine} at={first.createdAt} />
      <p className="mt-1 mb-1.5 text-[15px] text-fg whitespace-pre-wrap break-words">
        {isNew && <span className={cn(ui.badge, 'mr-1.5 align-[1px]')}>새 답장</span>}
        {first.content}
      </p>
      <button type="button" className="px-2 py-1 -ml-2 rounded-sm text-[13px] text-fg-weak hover:bg-field hover:text-fg-sub" onClick={() => setOpen((o) => !o)}>
        답글{letters.length > 0 && ` ${letters.length}`}
      </button>
      {letters.length > 0 && (
        <ul className="list-none m-0 mt-2 ml-3 pl-4 border-l-2 border-line" aria-label="이어 주고받은 편지">
          {letters.map((l) => (
            <li key={l.id} className="pt-2.5 first:pt-0.5">
              <Head mine={l.mine} at={l.createdAt} small />
              <p className="mt-1 mb-0 text-[15px] text-fg whitespace-pre-wrap break-words">{l.content}</p>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <form className="grid gap-1.5 mt-2" onSubmit={submit}>
          <textarea
            className={cn(ui.textarea, 'min-h-[64px] text-[14px]')}
            maxLength={MAX}
            value={text}
            autoFocus
            placeholder={`${other}에게 답글 (서로 누군지는 끝까지 몰라요)`}
            onChange={(e) => setText(e.target.value)}
            aria-label="답글"
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={send.isPending || text.trim().length < 2}>
              답글 등록
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** 내가 답장한 병: 원래 병 · 내 답장 · 병 주인과 이어 주고받은 편지 */
function MyReplies() {
  const { data } = useBottleConversations();
  if (!data) return <div className={ui.spinner} />;
  if (!data.length) return <p className="m-0 px-6 pb-6 text-sm text-fg-weak">주운 병에 답장하면 여기서 병 주인과 편지를 이어 주고받을 수 있어요.</p>;
  return (
    <ul className="list-none m-0 px-4 pb-4 grid gap-3">
      {data.map((c) => (
        <li key={c.replyId} className="sea-mine">
          <div className="flex items-center gap-2 text-[12px] text-fg-weak">
            <span>🍾 주운 병 · {timeAgo(c.bottle.createdAt)} 띄움</span>
            {c.unread > 0 && <span className="ml-auto font-bold text-primary">새 편지 {c.unread}</span>}
          </div>
          <blockquote className="sea-quote">{c.bottle.content}</blockquote>
          <Letters replyId={c.replyId} first={{ ...c.reply, mine: true }} letters={c.letters} other="병을 띄운 사람" />
        </li>
      ))}
    </ul>
  );
}

function MyBottles() {
  const { data } = useMyBottles();
  if (!data) return <div className={ui.spinner} />;
  if (!data.length) return <p className="m-0 px-6 pb-6 text-sm text-fg-weak">아직 띄운 병이 없어요. 첫 병을 띄워 보세요.</p>;
  return (
    <ul className="list-none m-0 px-4 pb-4 grid gap-3">
      {data.map((b) => (
        <li key={b.id} className="sea-mine">
          <div className="flex items-center gap-2">
            <span className={cn('sea-status', `is-${b.status}`)}>{STATUS[b.status]}</span>
            <span className="text-[12px] text-fg-weak">
              {b.hops}명을 거쳤어요 · {timeAgo(b.createdAt)} 띄움
            </span>
          </div>
          <p className="m-0 mt-2 text-[14px] text-fg line-clamp-3 whitespace-pre-wrap">{b.content}</p>
          <Journey bottle={b} />
          <h3 className="sea-replies-title">
            💬 답장 {b.replies.length}개{b.replies.some((r) => !r.read) && <span className="ml-1.5 text-primary">· 새 답장</span>}
          </h3>
          {b.replies.length > 0 ? (
            <ul className="sea-comments">
              {b.replies.map((r) => (
                <li key={r.id}>
                  <Letters
                    replyId={r.id}
                    first={{ content: r.content, createdAt: r.createdAt, mine: false }}
                    letters={r.letters ?? []}
                    other="어느 바닷가의 누군가"
                    isNew={!r.read}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[13px] text-fg-weak">아직 답장이 없어요. 누군가 주워 답장하면 여기 보여요.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SeaPage() {
  const { data: sea } = useSea();
  const [composing, setComposing] = useState(false);
  return (
    <Page variant="single">
      <section className={cn(ui.card, 'overflow-hidden')}>
        <div className="sea-hero">
          <SeaScene bottle={!!sea?.held} />
          <div className="sea-hero-text">
            <h1 className="m-0 text-[24px] font-extrabold">메시지 표류병</h1>
            <p className="m-0 mt-1 text-[14px] opacity-90">병에 담은 말은 바다를 떠다니다 낯선 누군가에게 닿아요.</p>
            {sea && (
              <p className="m-0 mt-2 text-[13px] opacity-80 tabular-nums">
                떠다니는 병 {sea.drifting}개 · 오늘 주울 수 있는 병 {sea.catchesLeft}개
              </p>
            )}
          </div>
        </div>
        <div className="p-5 grid gap-4">
          {sea?.held ? (
            <HeldLetter key={sea.held.id} {...sea.held} />
          ) : (
            sea && (
              <p className="m-0 text-center text-[14px] text-fg-sub">
                {sea.catchesLeft === 0 ? '오늘은 병을 다 주웠어요. 내일 다시 바다를 보러 와요 🌊' : '지금은 떠내려온 병이 없어요. 조금 뒤에 다시 와 보세요 🌊'}
              </p>
            )
          )}
          {composing ? (
            <Compose left={sea?.throwsLeft ?? 0} onDone={() => setComposing(false)} />
          ) : (
            <button
              type="button"
              className={cn(ui.button, ui.primary, ui.large, 'w-full')}
              disabled={!sea || sea.throwsLeft === 0}
              onClick={() => setComposing(true)}
            >
              {sea && sea.throwsLeft === 0 ? '오늘은 병을 다 띄웠어요' : '🍾 병 띄우기'}
            </button>
          )}
        </div>
      </section>
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h2 className={ui.sectionTitle}>
            내가 띄운 병{!!sea?.unreadReplies && <span className="ml-2 align-[2px] text-[12px] font-bold text-primary">새 답장 {sea.unreadReplies}</span>}
          </h2>
        </div>
        <MyBottles />
      </section>
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h2 className={ui.sectionTitle}>
            내가 답장한 병{!!sea?.unreadLetters && <span className="ml-2 align-[2px] text-[12px] font-bold text-primary">새 편지 {sea.unreadLetters}</span>}
          </h2>
        </div>
        <MyReplies />
      </section>
    </Page>
  );
}
