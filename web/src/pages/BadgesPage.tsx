import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  isUserId,
  useAuth,
  useBadgeBook,
  useFeatureBadge,
  useUserProfile,
  type BadgeCard,
  type BadgeCategory,
  type BadgeTier,
} from '@loop/shared';
import { BadgeMedal, TIER_LABEL } from '../components/BadgeMedal';
import { Page } from '../components/Layout';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import NotFoundPage from './NotFoundPage';

const CATEGORIES: [BadgeCategory | 'all', string][] = [
  ['all', '전체'],
  ['activity', '활동'],
  ['reaction', '반응'],
  ['loop', '루프 기능'],
  ['explore', '탐험'],
  ['time', '시간'],
  ['hidden', '숨은 배지'],
];
const TIERS: BadgeTier[] = ['legendary', 'rare', 'common'];
type Show = 'all' | 'earned' | 'left';

const earnedOn = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};
const holdersText = (p: number) => (p === 0 ? '아직 아무도 없어요' : p < 1 ? '회원의 1% 미만이 가지고 있어요' : `회원의 ${Math.round(p)}%가 가지고 있어요`);

function Progress({ value, goal, label = '진행도' }: { value: number; goal: number; label?: string }) {
  const p = Math.min(1, goal ? value / goal : 0);
  return (
    <div className="badge-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value, goal)}>
      <span style={{ '--p': p } as React.CSSProperties} />
    </div>
  );
}

/** 도감 한 칸 */
function Card({ b, featured, onOpen }: { b: BadgeCard; featured: boolean; onOpen: () => void }) {
  const secret = b.hidden && !b.earned;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn('badge-card relative w-full h-full flex flex-col items-center text-center gap-2 rounded-lg border border-border bg-surface px-3 pt-5 pb-4', !b.earned && 'bg-[color-mix(in_srgb,var(--field)_45%,var(--surface))]')}
        data-earned={b.earned || undefined}
        data-tier={b.tier}
      >
        {featured && <span className="absolute top-2 right-2 px-1.5 py-px rounded-sm bg-primary text-white text-[11px] font-bold">대표</span>}
        <BadgeMedal icon={b.icon} tier={b.tier} size={60} locked={!b.earned} secret={secret} />
        <div className="min-w-0 w-full">
          <div className={cn('text-[15px] font-bold truncate', b.earned ? 'text-fg-strong' : 'text-fg-sub')}>{b.name}</div>
          <div className="mt-0.5 text-[12.5px] leading-snug text-fg-weak line-clamp-2 min-h-[2lh]">{b.description}</div>
        </div>
        <div className="mt-auto w-full">
          {b.earned ? (
            <div className="text-[12px] text-fg-weak">
              <span className="badge-tier-text font-bold" data-tier={b.tier}>
                {TIER_LABEL[b.tier]}
              </span>{' '}
              · {earnedOn(b.earnedAt)}
            </div>
          ) : b.progress ? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Progress value={b.progress[0]} goal={b.progress[1]} />
              </div>
              <span className="text-[11.5px] tabular-nums text-fg-weak">
                {Math.min(b.progress[0], b.progress[1]).toLocaleString()}/{b.progress[1].toLocaleString()}
              </span>
            </div>
          ) : (
            <div className={cn('text-[12px] font-semibold', secret ? 'text-fg-weak' : 'badge-tier-text')} data-tier={b.tier}>
              {secret ? '숨은 배지' : TIER_LABEL[b.tier]}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

/** 배지 자세히: 조건 · 진행도 · 가진 사람 비율 · 대표 배지로 달기 */
function Detail({ b, mine, featured, onClose }: { b: BadgeCard; mine: boolean; featured: boolean; onClose: () => void }) {
  const feature = useFeatureBadge();
  const secret = b.hidden && !b.earned;
  const set = (code: string | null) =>
    feature.mutate(code, {
      onSuccess: () => {
        toast(code ? `'${b.name}'을 대표 배지로 달았어요` : '대표 배지를 뗐어요');
        onClose();
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : '바꾸지 못했어요'),
    });
  return (
    <Modal onClose={onClose}>
      <div role="dialog" aria-modal aria-label={b.name} className="w-full max-w-[360px] rounded-xl border border-border bg-surface shadow-pop px-6 pt-8 pb-6 text-center">
        <BadgeMedal icon={b.icon} tier={b.tier} size={104} locked={!b.earned} secret={secret} className="mx-auto" />
        <div className={cn('mt-4 text-[13px] font-bold', secret ? 'text-fg-weak' : 'badge-tier-text')} data-tier={b.tier}>
          {secret ? '숨은 배지' : `${TIER_LABEL[b.tier]} 배지`}
        </div>
        <h2 className="mt-1 mb-0 text-[21px] font-bold text-fg-strong">{b.name}</h2>
        <p className="mt-2 mb-0 text-[15px] text-fg-sub leading-relaxed">{b.description}</p>
        {!b.earned && b.progress && (
          <div className="mt-5 text-left">
            <div className="flex justify-between text-[13px] text-fg-weak mb-1.5">
              <span>진행도</span>
              <span className="tabular-nums">
                {Math.min(b.progress[0], b.progress[1]).toLocaleString()} / {b.progress[1].toLocaleString()}
              </span>
            </div>
            <Progress value={b.progress[0]} goal={b.progress[1]} />
          </div>
        )}
        <div className="mt-5 rounded-md bg-field px-4 py-3 text-[13px] text-fg-sub">
          {b.earned && <div className="font-semibold text-fg-strong mb-0.5">{earnedOn(b.earnedAt)} 달성</div>}
          {holdersText(b.holders)}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" className={cn(ui.button, ui.ghost, 'flex-1')} onClick={onClose}>
            닫기
          </button>
          {mine && b.earned && (
            <button
              type="button"
              className={cn(ui.button, featured ? ui.secondary : ui.primary, 'flex-1')}
              disabled={feature.isPending}
              onClick={() => set(featured ? null : b.code)}
            >
              {featured ? '대표 배지 떼기' : '대표 배지로 달기'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** 배지 도감: /badges (내 것) · /u/:id/badges (다른 사람). 숨은 배지는 받기 전까지 '???' */
export default function BadgesPage() {
  const id = useParams().id;
  const { user: me } = useAuth();
  const mine = id == null || id === me?.id;
  const book = useBadgeBook(mine ? undefined : id);
  const profile = useUserProfile(mine ? '' : (id ?? ''));
  const [cat, setCat] = useState<BadgeCategory | 'all'>('all');
  const [show, setShow] = useState<Show>('all');
  const [open, setOpen] = useState<string>();

  const data = book.data;
  const counts = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const b of data?.badges ?? []) {
      for (const k of ['all', b.category]) {
        const [e, t] = m.get(k) ?? [0, 0];
        m.set(k, [e + (b.earned ? 1 : 0), t + 1]);
      }
    }
    return m;
  }, [data]);
  const tiers = useMemo(
    () => TIERS.map((t) => [t, (data?.badges ?? []).filter((b) => b.tier === t && b.earned).length, (data?.badges ?? []).filter((b) => b.tier === t).length] as const),
    [data],
  );

  if ((id != null && !isUserId(id)) || (book.error instanceof ApiError && book.error.status === 404)) {
    return <NotFoundPage message="없는 사용자예요" />;
  }
  const list = (data?.badges ?? []).filter(
    (b) => (cat === 'all' || b.category === cat) && (show === 'all' || (show === 'earned' ? b.earned : !b.earned)),
  );
  const featured = data?.badges.find((b) => b.code === data.featured);
  const opened = data?.badges.find((b) => b.code === open);
  const owner = mine ? '내' : profile.data ? `${profile.data.nickname}의` : '';
  const pct = data ? Math.round((data.earned / data.total) * 100) : 0;

  return (
    <Page variant="single">
      <section className={cn(ui.card, 'px-6 py-6 max-[520px]:px-4')}>
        <div className="flex items-start gap-5 max-[520px]:flex-col max-[520px]:gap-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold text-fg-weak">
              {mine ? (
                '배지 도감'
              ) : (
                <Link to={`/u/${id}`} className="hover:text-primary">
                  {profile.data?.nickname ?? '…'} 님의 프로필
                </Link>
              )}
            </p>
            <h1 className="mt-1 mb-0 text-[24px] font-bold text-fg-strong">{owner} 배지 도감</h1>
            {data ? (
              <>
                <p className="mt-2 mb-0 text-[15px] text-fg-sub">
                  <b className="text-fg-strong tabular-nums">{data.earned}</b> / {data.total}개 모았어요 · {pct}%
                </p>
                <div className="mt-3 max-w-[420px]">
                  <Progress value={data.earned} goal={data.total} label="배지 모은 정도" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {tiers.map(([t, e, n]) => (
                    <span key={t} className="text-fg-weak">
                      <span className="badge-tier-text font-bold" data-tier={t}>
                        {TIER_LABEL[t]}
                      </span>{' '}
                      <span className="tabular-nums">
                        {e}/{n}
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span className={cn(ui.skeleton, 'block mt-3')} style={{ width: 240, height: 20 }} />
            )}
          </div>
          {/* 대표 배지: 닉네임 옆에 함께 보인다 */}
          <div className="flex-none flex items-center gap-3 rounded-lg border border-border px-4 py-3 min-w-[210px] max-[520px]:w-full">
            {featured ? (
              <>
                <BadgeMedal icon={featured.icon} tier={featured.tier} size={48} />
                <div className="min-w-0">
                  <div className="text-[12px] text-fg-weak">대표 배지</div>
                  <div className="text-[15px] font-bold text-fg-strong truncate">{featured.name}</div>
                </div>
              </>
            ) : (
              <>
                <span className="grid place-items-center w-12 h-12 rounded-full border-2 border-dashed border-border text-fg-weak text-lg" aria-hidden>
                  ＋
                </span>
                <div className="min-w-0 text-[13px] text-fg-weak leading-snug">
                  {mine ? (
                    <>
                      대표 배지가 없어요
                      <br />
                      받은 배지를 눌러 달아 보세요
                    </>
                  ) : (
                    '대표 배지가 없어요'
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div role="tablist" aria-label="배지 종류" className={cn(ui.tabs, 'px-3')}>
          {CATEGORIES.map(([k, label]) => {
            const [e, t] = counts.get(k) ?? [0, 0];
            return (
              <button key={k} type="button" role="tab" aria-selected={cat === k} className={ui.tab} onClick={() => setCat(k)}>
                {label} <span className="text-[12px] font-medium text-fg-weak tabular-nums">{data ? `${e}/${t}` : ''}</span>
              </button>
            );
          })}
        </div>
        <div className={cn(ui.chips, 'px-5 pt-4 max-[520px]:px-4')}>
          {(
            [
              ['all', '모두'],
              ['earned', '받은 배지'],
              ['left', '남은 배지'],
            ] as [Show, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className={cn(ui.chip, 'h-8')} aria-pressed={show === k} onClick={() => setShow(k)}>
              {label}
            </button>
          ))}
        </div>
        {!data ? (
          <div className={ui.spinner} />
        ) : list.length === 0 ? (
          <p className={ui.empty}>{show === 'earned' ? '아직 받은 배지가 없어요' : '모두 모았어요! 🎉'}</p>
        ) : (
          <ul className="list-none m-0 p-5 grid grid-cols-4 gap-3 max-[860px]:grid-cols-3 max-[560px]:grid-cols-2 max-[560px]:p-4 max-[560px]:gap-2.5">
            {list.map((b) => (
              <Card key={b.code} b={b} featured={b.code === data.featured} onOpen={() => setOpen(b.code)} />
            ))}
          </ul>
        )}
      </section>
      {opened && <Detail b={opened} mine={mine} featured={opened.code === data?.featured} onClose={() => setOpen(undefined)} />}
    </Page>
  );
}
