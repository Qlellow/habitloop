import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useChallengeAction, useChallenges, useCheckHabit, useHabitMutation, useHabits, type Habit } from '@loop/shared';
import { toast } from './Toast';
import { ui } from './ui';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/cn';
import { ask } from './ConfirmHost';

/**
 * 습관 체크인 화면 조각:
 *  - HabitCard: 습관 하나 (오늘 체크 · 연속 일수 · 12주 잔디 · 깜빡한 어제 · 그제 채우기)
 *  - HabitList: 마이페이지 > 습관 (만들기 · 고치기 · 보관)
 *  - HabitsWidgetBody: 홈 위젯 (오늘 체크만)
 *  - ChallengesCard: 채널 오른쪽 '챌린지' (참여 · 순위 · 운영진은 열기)
 */

const EMOJIS = ['✅', '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '✍️', '🎧', '🧹', '💊'];

/** n 일 전 (한국 날짜 'YYYY-MM-DD') */
const kstDay = (ago: number) => new Date(Date.now() + 9 * 3600_000 - ago * 86400_000).toISOString().slice(0, 10);

function CheckButton({ habit, size = 'large' }: { habit: Habit; size?: 'large' | 'small' }) {
  const check = useCheckHabit();
  return (
    <button
      type="button"
      className={cn('habit-check', size === 'small' && 'is-small', habit.checkedToday && 'is-done')}
      aria-pressed={habit.checkedToday}
      aria-label={`${habit.title} 오늘 ${habit.checkedToday ? '체크 취소' : '체크하기'}`}
      onClick={() =>
        check.mutate(
          { id: habit.id, on: !habit.checkedToday },
          {
            onSuccess: (h) => h.checkedToday && toast(h.streak > 1 ? `🔥 ${h.streak}일째 이어 가고 있어요!` : '오늘도 체크! 펫이 경험치를 받았어요'),
            onError: (e) => toast(e.message),
          },
        )
      }
    >
      {habit.checkedToday ? '✓' : habit.emoji}
    </button>
  );
}

/** 12주 잔디: 열 = 주, 행 = 요일 (오래된 날 → 오늘) */
function Grass({ grass }: { grass: boolean[] }) {
  return (
    <div className="habit-grass" role="img" aria-label={`최근 12주 동안 ${grass.filter(Boolean).length}일 체크`}>
      {grass.map((on, i) => (
        <i key={i} data-on={on || undefined} />
      ))}
    </div>
  );
}

export function HabitCard({ habit, onEdit }: { habit: Habit; onEdit?: () => void }) {
  const check = useCheckHabit();
  const fill = (ago: number, on: boolean) => check.mutate({ id: habit.id, on, day: kstDay(ago) }, { onError: (e) => toast(e.message) });
  // 어제 · 그제 (잔디 끝에서 두 · 세 번째)
  const past = [1, 2].map((ago) => ({ ago, on: habit.grass[habit.grass.length - 1 - ago] }));
  return (
    <article className="habit-card">
      <div className="flex items-center gap-3">
        <CheckButton habit={habit} />
        <div className="flex-1 min-w-0">
          <h3 className="m-0 truncate text-[16px] font-bold text-fg-strong">{habit.title}</h3>
          <p className="m-0 text-[13px] text-fg-sub">
            {habit.streak > 0 ? <b className="text-[#f06a1d]">🔥 {habit.streak}일 연속</b> : '오늘 시작해 볼까요?'} · 최고 {habit.best}일 · 모두 {habit.total}일
          </p>
          {habit.challenge && (
            <Link to={`/c/${habit.challenge.channelSlug}`} className="text-[12px] font-semibold text-primary">
              🏁 {habit.challenge.channelName} 챌린지 · ~{habit.challenge.endsOn.slice(5).replace('-', '.')}
            </Link>
          )}
        </div>
        {onEdit && (
          <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={onEdit}>
            고치기
          </button>
        )}
      </div>
      <Grass grass={habit.grass} />
      <div className="flex items-center gap-2 text-[12px] text-fg-weak">
        깜빡했다면:
        {past.map(({ ago, on }) => (
          <button key={ago} type="button" className={cn('habit-past', on && 'is-on')} aria-pressed={!!on} onClick={() => fill(ago, !on)}>
            {ago === 1 ? '어제' : '그제'} {on ? '✓' : ''}
          </button>
        ))}
      </div>
    </article>
  );
}

function HabitForm({ initial, onDone }: { initial?: Habit; onDone: () => void }) {
  const save = useHabitMutation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    save.mutate(initial ? { update: initial.id, title: title.trim(), emoji } : { create: { title: title.trim(), emoji } }, {
      onSuccess: () => {
        toast(initial ? '습관을 고쳤어요' : '새 습관을 만들었어요');
        onDone();
      },
      onError: (err) => toast(err.message),
    });
  };
  return (
    <form className="habit-card" onSubmit={submit}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="아이콘">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            className={cn('habit-emoji', emoji === e && 'is-on')}
            onClick={() => setEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        className={ui.input}
        value={title}
        maxLength={30}
        placeholder="예: 물 2L 마시기, 30분 걷기, 책 10쪽"
        aria-label="습관 이름"
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        {initial && (
          <button
            type="button"
            className={cn(ui.button, ui.text, ui.small, ui.danger, 'mr-auto')}
            onClick={async () => {
              if (
                !(await ask('이 습관을 보관할까요?', {
                  message: '목록에서 빠지고, 체크 기록은 남아요. 챌린지 습관이면 챌린지에서도 빠져요.',
                  confirmLabel: '보관',
                  danger: true,
                }))
              )
                return;
              save.mutate(
                { archive: initial.id },
                {
                  onSuccess: () => {
                    toast('습관을 보관했어요');
                    onDone();
                  },
                  onError: (err) => toast(err.message),
                },
              );
            }}
          >
            보관
          </button>
        )}
        <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={onDone}>
          취소
        </button>
        <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={!title.trim() || save.isPending}>
          {initial ? '저장' : '만들기'}
        </button>
      </div>
    </form>
  );
}

/** 마이페이지 > 습관 */
export function HabitList() {
  const habits = useHabits();
  const [editing, setEditing] = useState<number | 'new'>();
  if (habits.isPending) return <div className={ui.spinner} />;
  const list = habits.data ?? [];
  const done = list.filter((h) => h.checkedToday).length;
  return (
    <div className="grid gap-3">
      {list.length > 0 && (
        <p className="m-0 text-sm text-fg-sub">
          오늘 {list.length}개 중 <b className="text-fg-strong">{done}개</b> 체크했어요{done === list.length ? ' 🎉' : ''}
        </p>
      )}
      {list.map((h) =>
        editing === h.id ? (
          <HabitForm key={h.id} initial={h} onDone={() => setEditing(undefined)} />
        ) : (
          <HabitCard key={h.id} habit={h} onEdit={() => setEditing(h.id)} />
        ),
      )}
      {editing === 'new' ? (
        <HabitForm onDone={() => setEditing(undefined)} />
      ) : (
        <button type="button" className={cn(ui.button, ui.secondary, 'w-full')} disabled={list.length >= 10} onClick={() => setEditing('new')}>
          {list.length >= 10 ? '습관은 10개까지 만들 수 있어요' : '+ 새 습관'}
        </button>
      )}
    </div>
  );
}

/** 홈 위젯: 오늘 체크만 빠르게 */
export function HabitsWidgetBody() {
  const { isLoggedIn } = useAuth();
  const habits = useHabits(isLoggedIn);
  if (!isLoggedIn) return <p className="m-0 px-5 pb-5 text-sm text-fg-sub">로그인하면 습관을 만들고 매일 체크할 수 있어요</p>;
  if (habits.isPending) return <div className={ui.spinner} />;
  if (!habits.data?.length) {
    return (
      <div className="px-5 pb-5 text-sm text-fg-sub">
        아직 습관이 없어요.{' '}
        <Link to="/me/habits" className="font-semibold text-primary">
          첫 습관 만들기
        </Link>
      </div>
    );
  }
  return (
    <ul className="list-none m-0 px-3 pb-3 grid gap-1">
      {habits.data.map((h) => (
        <li key={h.id} className="flex items-center gap-2.5 px-2 py-1.5">
          <CheckButton habit={h} size="small" />
          <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-fg-strong">{h.title}</span>
          {h.streak > 0 && <span className="text-[12px] font-bold text-[#f06a1d]">🔥{h.streak}</span>}
        </li>
      ))}
    </ul>
  );
}

/** 채널 오른쪽: 진행 중인 챌린지 · 참여 · 상위 5명 (운영진은 새로 열기) */
export function ChallengesCard({ slug, staff, joined }: { slug: string; staff: boolean; joined: boolean }) {
  const { isLoggedIn } = useAuth();
  const list = useChallenges(slug);
  const act = useChallengeAction(slug);
  const [opening, setOpening] = useState(false);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(30);
  if (!list.data || (!list.data.length && !staff)) return null;
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle}>챌린지</h2>
        {staff && !opening && (
          <button type="button" className={ui.cardLink} onClick={() => setOpening(true)}>
            + 열기
          </button>
        )}
      </div>
      {opening && (
        <form
          className="grid gap-2 px-5 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate(
              { open: { title: title.trim(), emoji: '🏁', days } },
              {
                onSuccess: () => {
                  setOpening(false);
                  setTitle('');
                  toast('챌린지를 열었어요');
                },
                onError: (err) => toast(err.message),
              },
            );
          }}
        >
          <input
            className={ui.input}
            value={title}
            maxLength={30}
            placeholder="예: 30일 매일 걷기"
            aria-label="챌린지 이름"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-fg-sub">
            기간
            <select className="h-8 rounded-sm bg-field px-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 21, 30, 60].map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setOpening(false)}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={!title.trim() || act.isPending}>
              열기
            </button>
          </div>
        </form>
      )}
      {list.data.length === 0 && !opening && <p className="m-0 px-5 pb-5 text-sm text-fg-weak">팔로워와 함께할 챌린지를 열어 보세요</p>}
      <ul className="list-none m-0 px-4 pb-4 grid gap-3">
        {list.data.map((c) => (
          <li key={c.id} className="habit-card">
            <div className="flex items-start gap-2">
              <span className="text-[22px] leading-none">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <b className="block truncate text-[15px] text-fg-strong">{c.title}</b>
                <span className="text-[12px] text-fg-weak">
                  {c.startsOn.slice(5).replace('-', '.')} ~ {c.endsOn.slice(5).replace('-', '.')} · {c.participants}명 참여{c.ended ? ' · 끝남' : ''}
                </span>
              </div>
            </div>
            {c.joined && c.myDone != null && (
              <div className="grid gap-1">
                <div className="h-2 rounded-full bg-field overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (c.myDone / c.days) * 100)}%` }} />
                </div>
                <span className="text-[12px] text-fg-sub">
                  내 기록 {c.myDone} / {c.days}일 ·{' '}
                  <Link to="/me/habits" className="text-primary font-semibold">
                    체크하러 가기
                  </Link>
                </span>
              </div>
            )}
            {!c.joined && !c.ended && isLoggedIn && (
              <button
                type="button"
                className={cn(ui.button, ui.primary, ui.small, 'w-full')}
                disabled={act.isPending || !joined}
                title={joined ? undefined : '채널을 팔로우하면 참여할 수 있어요'}
                onClick={() =>
                  act.mutate({ join: c.id }, { onSuccess: () => toast('참여했어요 · 내 습관에서 매일 체크해요'), onError: (e) => toast(e.message) })
                }
              >
                {joined ? '참여하기' : '팔로우하면 참여할 수 있어요'}
              </button>
            )}
            {c.top.length > 0 && (
              <ol className="list-none m-0 p-0 grid gap-1">
                {c.top.map((u, i) => (
                  <li key={u.id} className="flex items-center gap-2 text-[13px]">
                    <span className="w-4 text-fg-weak tabular-nums">{i + 1}</span>
                    <UserAvatar nickname={u.nickname} avatarUrl={u.avatarUrl} size={20} />
                    <span className="flex-1 min-w-0 truncate text-fg">{u.nickname}</span>
                    <span className="text-fg-sub tabular-nums">{u.done}일</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
