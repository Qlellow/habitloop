import { useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo, useAuth, useMySeries, useVote, type Poll, type PostSeries } from '@loop/shared';
import { toast } from './Toast';
import { ui } from './ui';
import { cn } from '../lib/cn';

/**
 * 글에 붙는 것들 (components/PostExtras):
 *  - PollCard: 투표 (결과는 투표했거나 · 마감됐거나 · 글쓴이일 때만)
 *  - SeriesBox: 연재 목차 + 이전 · 다음 화
 *  - PollEditor · SeriesPicker: 글쓰기 화면
 */

const leftLabel = (closesAt: string) => {
  const ms = Date.parse(closesAt) - Date.now();
  const h = Math.ceil(ms / 3600_000);
  return h <= 1 ? '곧 마감' : h < 24 ? `${h}시간 뒤 마감` : `${Math.ceil(h / 24)}일 뒤 마감`;
};

export function PollCard({ postId, poll }: { postId: number; poll: Poll }) {
  const { isLoggedIn } = useAuth();
  const vote = useVote(postId);
  const [picked, setPicked] = useState<number[]>(poll.myVotes);
  const voted = poll.myVotes.length > 0;
  const [editing, setEditing] = useState(false);
  const choosing = !poll.closed && isLoggedIn && (!voted || editing);
  const send = (ids: number[]) =>
    vote.mutate(ids, {
      onSuccess: () => {
        setEditing(false);
        toast(ids.length ? '투표했어요' : '투표를 취소했어요');
      },
      onError: (e) => toast(e.message),
    });
  const toggle = (id: number) => {
    if (!poll.multiple) return setPicked([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const top = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));

  return (
    <section className="poll" aria-label="투표">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="m-0 text-[15px] font-bold text-fg-strong">
          투표 <span className="text-[13px] font-medium text-fg-weak">{poll.multiple ? '여러 개 고르기' : '하나 고르기'}</span>
        </h2>
        <span className="text-[13px] text-fg-weak">
          {poll.voters.toLocaleString()}명 참여 · {poll.closed ? '마감됨' : poll.closesAt ? leftLabel(poll.closesAt) : '마감 없음'}
        </span>
      </div>
      <ul className="flex flex-col gap-2 m-0 p-0 list-none">
        {poll.options.map((o) => {
          const pct = poll.revealed && poll.total ? Math.round(((o.votes ?? 0) / poll.total) * 100) : 0;
          const mine = poll.myVotes.includes(o.id);
          return (
            <li key={o.id}>
              {choosing ? (
                <label className={cn('poll-choice', picked.includes(o.id) && 'is-picked')}>
                  <input type={poll.multiple ? 'checkbox' : 'radio'} name={`poll-${postId}`} checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
                  <span>{o.label}</span>
                </label>
              ) : (
                <div className={cn('poll-result', mine && 'is-mine', poll.revealed && (o.votes ?? 0) === top && top > 0 && 'is-top')}>
                  <i style={{ width: `${pct}%` }} aria-hidden />
                  <span className="relative min-w-0 truncate">
                    {o.label}
                    {mine && <b className="ml-1.5 text-[12px] text-primary">✓ 내 선택</b>}
                  </span>
                  {poll.revealed && (
                    <span className="relative tabular-nums text-[13px] font-semibold">
                      {pct}% <span className="font-normal text-fg-weak">({(o.votes ?? 0).toLocaleString()})</span>
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 mt-3">
        {choosing ? (
          <>
            <button type="button" className={cn(ui.button, ui.primary, ui.small)} disabled={!picked.length || vote.isPending} onClick={() => send(picked)}>
              {voted ? '다시 투표하기' : '투표하기'}
            </button>
            {editing && (
              <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setEditing(false)}>
                그대로 두기
              </button>
            )}
            {!poll.revealed && <span className="text-[13px] text-fg-weak">투표하면 결과를 볼 수 있어요</span>}
          </>
        ) : !poll.closed && !isLoggedIn ? (
          <Link to="/login" state={{ from: `/posts/${postId}` }} className={cn(ui.button, ui.secondary, ui.small)}>
            로그인하고 투표하기
          </Link>
        ) : (
          !poll.closed &&
          voted && (
            <>
              <button
                type="button"
                className={cn(ui.button, ui.ghost, ui.small)}
                onClick={() => {
                  setPicked(poll.myVotes);
                  setEditing(true);
                }}
              >
                투표 바꾸기
              </button>
              <button type="button" className={cn(ui.button, ui.text, ui.small)} disabled={vote.isPending} onClick={() => send([])}>
                취소
              </button>
            </>
          )
        )}
        {poll.closed && poll.closesAt && <span className="text-[13px] text-fg-weak">{timeAgo(poll.closesAt)} 마감된 투표예요</span>}
      </div>
    </section>
  );
}

/** 연재: 시리즈 이름 · 몇 화인지 · 이전 · 다음 화, 펼치면 목차 */
export function SeriesBox({ series }: { series: PostSeries }) {
  const [open, setOpen] = useState(false);
  const prev = series.posts[series.index - 1];
  const next = series.posts[series.index + 1];
  return (
    <nav className="series-box" aria-label={`시리즈 ${series.title}`}>
      <button type="button" className="series-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="series-tag">시리즈</span>
        <b className="min-w-0 truncate">{series.title}</b>
        <span className="ml-auto text-[13px] text-fg-weak tabular-nums">
          {series.index + 1} / {series.posts.length}화 {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <ol className="series-list">
          {series.posts.map((p, i) => (
            <li key={p.id}>
              {i === series.index ? (
                <span aria-current="page">
                  {i + 1}. {p.title}
                </span>
              ) : (
                <Link to={`/posts/${p.id}`}>
                  {i + 1}. {p.title}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
      {(prev || next) && (
        <div className="series-nav">
          {prev ? (
            <Link to={`/posts/${prev.id}`} className="min-w-0">
              <small>‹ 이전 화</small>
              <span className="truncate">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/posts/${next.id}`} className="min-w-0 text-right">
              <small>다음 화 ›</small>
              <span className="truncate">{next.title}</span>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}

export interface PollDraft {
  options: string[];
  multiple: boolean;
  hours: number | null;
}

const DEADLINES: [number | null, string][] = [
  [null, '마감 없음'],
  [24, '1일 뒤'],
  [72, '3일 뒤'],
  [168, '7일 뒤'],
];

/** 글쓰기: 투표 만들기 (선택지 2~6개) */
export function PollEditor({ value, onChange }: { value: PollDraft; onChange: (v: PollDraft | undefined) => void }) {
  const set = (patch: Partial<PollDraft>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="poll-editor">
      <legend className="sr-only">투표</legend>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[15px] font-bold text-fg-strong" aria-hidden>
          투표
        </span>
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => onChange(undefined)}>
          투표 빼기
        </button>
      </div>
      <ol className="flex flex-col gap-2 m-0 p-0 list-none">
        {value.options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              className={cn(ui.input, 'flex-1')}
              value={o}
              maxLength={50}
              placeholder={`선택지 ${i + 1}`}
              aria-label={`선택지 ${i + 1}`}
              onChange={(e) => set({ options: value.options.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            {value.options.length > 2 && (
              <button
                type="button"
                className={cn(ui.button, ui.text, ui.small, 'px-2')}
                aria-label={`선택지 ${i + 1} 빼기`}
                onClick={() => set({ options: value.options.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
        {value.options.length < 6 && (
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => set({ options: [...value.options, ''] })}>
            + 선택지
          </button>
        )}
        <label className="inline-flex items-center gap-1.5 text-fg-sub">
          <input type="checkbox" checked={value.multiple} onChange={(e) => set({ multiple: e.target.checked })} />
          여러 개 고르기
        </label>
        <label className="inline-flex items-center gap-1.5 text-fg-sub">
          마감
          <select
            className="h-8 rounded-sm bg-field px-2 text-sm"
            value={value.hours ?? ''}
            onChange={(e) => set({ hours: e.target.value ? Number(e.target.value) : null })}
          >
            {DEADLINES.map(([h, label]) => (
              <option key={label} value={h ?? ''}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={ui.help}>투표는 글을 올린 뒤에는 바꿀 수 없어요.</p>
    </fieldset>
  );
}

/** 글쓰기: 시리즈 고르기 · 새로 만들기. value: 시리즈 번호(null = 없음) 또는 'new' */
export function SeriesPicker({
  value,
  name,
  onChange,
  onName,
}: {
  value: number | null | 'new';
  name: string;
  onChange: (v: number | null | 'new') => void;
  onName: (v: string) => void;
}) {
  const mine = useMySeries();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="inline-flex items-center gap-1.5 font-semibold text-fg-sub">
        시리즈
        <select
          className="h-8 max-w-[220px] rounded-sm bg-field px-2 text-sm font-normal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'new' ? 'new' : Number(e.target.value))}
        >
          <option value="">없음</option>
          {mine.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.count}화)
            </option>
          ))}
          <option value="new">+ 새 시리즈 만들기</option>
        </select>
      </label>
      {value === 'new' && (
        <input
          className={cn(ui.input, 'w-auto flex-1 min-w-[180px] h-8')}
          value={name}
          maxLength={60}
          placeholder="시리즈 이름 (예: 달의 도서관)"
          onChange={(e) => onName(e.target.value)}
          aria-label="새 시리즈 이름"
          autoFocus
        />
      )}
    </div>
  );
}
