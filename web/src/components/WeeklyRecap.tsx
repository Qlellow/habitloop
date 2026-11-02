import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, compact, useAuth, useWeeklyRecap, type WeeklyRecap } from '@loop/shared';
import { BadgeMedal } from './BadgeMedal';
import { ShareDialog } from './ShareDialog';
import { toast } from './Toast';
import { ui } from './ui';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/cn';

/**
 * 주간 회고 카드: 한 주(월 ~ 일) 동안의 활동을 카드 한 장으로.
 * 주소의 ?week= 로 주를 고르고(없으면 지난주), 본인이면 카톡 공유 · 이미지 저장을 할 수 있다.
 * 공유 링크에는 서명(?s=)이 붙어서 받은 사람에게도 출석한 요일이 보인다 (그냥 프로필 주소로 들어오면 안 보인다).
 */

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/** 'YYYY-MM-DD' 에 며칠 더하기 (시간대와 상관없이 날짜만) */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const md = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return { m, d };
};

/** 10월 26일 – 11월 1일 (같은 달이면 뒤 달은 줄인다) */
export function rangeLabel(week: WeeklyRecap['week']) {
  const a = md(week.start);
  const b = md(week.end);
  return `${a.m}월 ${a.d}일 – ${a.m === b.m ? '' : `${b.m}월 `}${b.d}일`;
}

/** 이번 주 · 지난주 · n주 전 */
function ago(week: WeeklyRecap['week'], today = new Date()) {
  if (week.current) return '이번 주';
  const kst = new Date(today.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const weeks = Math.round((Date.parse(kst) - Date.parse(week.start)) / (7 * 86400_000));
  return weeks <= 1 ? '지난주' : `${weeks}주 전`;
}

export const hourLabel = (h: number) =>
  h === 0 ? '밤 12시' : h < 6 ? `새벽 ${h}시` : h < 12 ? `오전 ${h}시` : h === 12 ? '낮 12시' : h < 18 ? `오후 ${h - 12}시` : `밤 ${h - 12}시`;

/** 그 주를 한 줄로 */
export function headline(r: WeeklyRecap) {
  const s = r.stats;
  const days = r.attendance?.filter(Boolean).length ?? 0;
  if (!s.posts && !s.comments && !s.cheersGiven && !s.likesReceived) return r.week.current ? '아직 조용한 한 주예요' : '조용히 쉬어 간 한 주';
  if (s.likesReceived >= 10 && s.likesReceived >= s.posts * 3) return `공감을 ${s.likesReceived.toLocaleString()}개나 받은 한 주`;
  if (s.posts >= 3) return `글을 ${s.posts}편 쓴 부지런한 한 주`;
  if (s.comments >= 5) return `댓글로 ${s.comments}번 이야기 나눈 한 주`;
  if (s.cheersGiven >= 5) return `응원을 ${s.cheersGiven}번 보낸 다정한 한 주`;
  if (days === 7) return '하루도 빠짐없이 들른 한 주';
  return '루프와 함께한 한 주';
}

/** 지난주보다 (+3 · −2 · 그대로) */
const delta = (now: number, prev: number) =>
  now === prev ? undefined : now > prev ? `+${(now - prev).toLocaleString()}` : `−${(prev - now).toLocaleString()}`;

/** 카톡 · 링크 공유 글 */
export function recapText(r: WeeklyRecap) {
  const s = r.stats;
  return `${headline(r)}\n글 ${s.posts} · 댓글 ${s.comments} · 받은 공감 ${s.likesReceived}`;
}

function Stat({ label, value, diff }: { label: string; value: number; diff?: string }) {
  return (
    <div className="recap-stat">
      <b>{compact(value)}</b>
      <span>{label}</span>
      {diff && (
        <small className={diff.startsWith('+') ? 'is-up' : 'is-down'} title="지난주보다">
          {diff}
        </small>
      )}
    </div>
  );
}

/** 카드 본문 (화면 · 이미지가 같은 내용을 그린다) */
export function RecapCard({ recap: r }: { recap: WeeklyRecap }) {
  const s = r.stats;
  const days = r.attendance?.filter(Boolean).length ?? 0;
  return (
    <article className="recap-card" aria-label={`${r.user.nickname}님의 주간 회고`}>
      <header className="flex items-center gap-3">
        <UserAvatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={44} className="ring-2 ring-white/60" />
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-semibold opacity-80">
            주간 회고 · {rangeLabel(r.week)}
            {r.week.current && ' (진행 중)'}
          </p>
          <h2 className="m-0 text-[17px] font-bold truncate">{r.user.nickname}님의 한 주</h2>
        </div>
      </header>
      <p className="recap-headline">{headline(r)}</p>

      <div className="recap-stats">
        <Stat label="쓴 글" value={s.posts} diff={delta(s.posts, r.prev.posts)} />
        <Stat label="댓글" value={s.comments} diff={delta(s.comments, r.prev.comments)} />
        <Stat label="받은 공감" value={s.likesReceived} diff={delta(s.likesReceived, r.prev.likesReceived)} />
        <Stat label="받은 반응" value={s.reactionsReceived} />
        <Stat label="내 글 읽힘" value={s.views} />
        <Stat label="보낸 응원" value={s.cheersGiven} />
      </div>

      {r.attendance && (
        <div className="recap-box">
          <div className="flex items-baseline justify-between gap-2">
            <span className="recap-box-title">출석</span>
            <span className="text-[13px] font-semibold opacity-85">7일 중 {days}일</span>
          </div>
          <ol className="recap-days">
            {DAYS.map((d, i) => (
              <li key={d} data-on={r.attendance![i] || undefined} aria-label={`${d}요일 ${r.attendance![i] ? '출석' : '쉼'}`}>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}

      {r.topPost && (
        <Link to={`/posts/${r.topPost.id}`} className="recap-box recap-top">
          <span className="recap-box-title">가장 반응이 좋았던 글</span>
          <b className="line-clamp-2">{r.topPost.title}</b>
          <span className="text-[13px] opacity-85">
            {r.topPost.channel.name} · 공감 {r.topPost.likes} · 댓글 {r.topPost.comments}
          </span>
        </Link>
      )}

      {(r.topChannel || r.peakHour != null) && (
        <dl className="recap-facts">
          {r.topChannel && (
            <div>
              <dt>가장 많이 머문 채널</dt>
              <dd>
                <Link to={`/c/${r.topChannel.slug}`}>{r.topChannel.name}</Link>
              </dd>
            </div>
          )}
          {r.peakHour != null && (
            <div>
              <dt>가장 활발한 시간</dt>
              <dd>{hourLabel(r.peakHour)}</dd>
            </div>
          )}
        </dl>
      )}

      {r.badges.length > 0 && (
        <div className="recap-box">
          <span className="recap-box-title">새로 받은 배지 {r.badges.length}개</span>
          <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
            {r.badges.map((b) => (
              <li key={b.code} className="flex items-center gap-1.5 text-[13px] font-semibold" title={b.name}>
                <BadgeMedal icon={b.icon} tier={b.tier} size={28} />
                {b.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="recap-foot">루프 커뮤니티</footer>
    </article>
  );
}

/** 주 고르기 + 카드 + (본인이면) 공유 · 이미지 저장 */
export function WeeklyRecapView({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const week = params.get('week') ?? undefined;
  const key = params.get('s') ?? undefined;
  const { data: r, error, isPending, isFetching } = useWeeklyRecap(userId, week, key);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const own = !!user && user.id === userId;

  if (isPending) return <div className={ui.spinner} />;
  if (!r) {
    return (
      <div className={cn(ui.card, 'p-8 text-center text-fg-sub')}>
        {error instanceof ApiError ? error.message : '주간 회고를 불러오지 못했어요'}
        <div className="mt-4">
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setParams({}, { replace: true })}>
            지난주 회고 보기
          </button>
        </div>
      </div>
    );
  }

  const prev = addDays(r.week.start, -7);
  const next = addDays(r.week.start, 7);
  // 다른 주로 넘기면 공유 서명은 맞지 않으니 뺀다
  const go = (day: string) => setParams({ week: day });
  const shareUrl = `${location.origin}/u/${r.user.id}/recap?week=${r.week.start}${r.shareKey ? `&s=${r.shareKey}` : ''}`;

  const saveImage = async () => {
    setSaving(true);
    try {
      const { drawRecap } = await import('../lib/recapImage');
      const blob = await drawRecap(r, headline(r));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loop-recap-${r.week.start}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast('회고 카드를 이미지로 저장했어요');
    } catch {
      toast('이미지를 만들지 못했어요. 잠시 후 다시 해 주세요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center justify-between gap-2" aria-label="주 고르기">
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => go(prev)} disabled={prev < r.firstWeek} aria-label="이전 주">
          ‹ 이전 주
        </button>
        <span className={cn('text-[15px] font-bold text-fg-strong text-center', isFetching && 'opacity-60')} aria-live="polite">
          {ago(r.week)}
          <span className="block text-[12px] font-medium text-fg-weak">{rangeLabel(r.week)}</span>
        </span>
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => go(next)} disabled={r.week.current} aria-label="다음 주">
          다음 주 ›
        </button>
      </nav>

      <RecapCard recap={r} />

      {own ? (
        <div className="flex gap-2 justify-center flex-wrap">
          <button type="button" className={cn(ui.button, ui.primary)} onClick={() => setSharing(true)}>
            공유하기
          </button>
          <button type="button" className={cn(ui.button, ui.ghost)} onClick={() => void saveImage()} disabled={saving}>
            {saving ? '만드는 중…' : '이미지로 저장'}
          </button>
        </div>
      ) : (
        <>
          {/* 공유 링크로 들어온 사람: 나도 해 보기 */}
          {!user && (
            <Link to="/signup" className={cn(ui.button, ui.primary, 'self-center')}>
              나도 루프에서 한 주 기록하기
            </Link>
          )}
          <p className="m-0 text-center text-[13px] text-fg-weak">
            공개 채널에서의 활동만 담겨요.{' '}
            <Link to={`/u/${r.user.id}`} className="text-primary font-semibold">
              {r.user.nickname}님 프로필 보기
            </Link>
          </p>
        </>
      )}

      {sharing && (
        <ShareDialog
          heading="주간 회고 공유하기"
          content={{ url: shareUrl, title: `${r.user.nickname}님의 주간 회고 (${rangeLabel(r.week)})`, text: recapText(r), buttonTitle: '회고 보기' }}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
