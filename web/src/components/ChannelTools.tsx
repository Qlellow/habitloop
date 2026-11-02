import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useChannelAutomod, useChannelRanking, useSetChannelAutomod, type ChannelRankRow } from '@loop/shared';
import { toast } from './Toast';
import { ui } from './ui';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/cn';
import { preload } from '../lib/preload';

/**
 * 채널 운영 도구 화면 조각:
 *  - AutomodSection: 채널 관리 > 자동 검열 (금칙어 · 링크 제한)
 *  - RankingCard: 채널 오른쪽의 '이번 달 랭킹' (상위 5명)
 *  - RankingTable: 랭킹 시즌 페이지의 표
 */

export function AutomodSection({ slug }: { slug: string }) {
  const automod = useChannelAutomod(slug);
  const save = useSetChannelAutomod(slug);
  const [words, setWords] = useState<string[]>([]);
  const [linkPolicy, setLinkPolicy] = useState<'all' | 'staff'>('all');
  const [word, setWord] = useState('');
  useEffect(() => {
    if (!automod.data) return;
    setWords(automod.data.bannedWords);
    setLinkPolicy(automod.data.linkPolicy);
  }, [automod.data]);
  const dirty = !!automod.data && (automod.data.linkPolicy !== linkPolicy || automod.data.bannedWords.join('\n') !== words.join('\n'));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const w = word.trim().toLowerCase();
    if (!w) return;
    if (!words.includes(w)) setWords([...words, w]);
    setWord('');
  };
  return (
    <section className={cn(ui.card, 'p-6 max-[520px]:p-4')}>
      <h2 className="m-0 text-[17px] font-bold text-fg-strong">자동 검열</h2>
      <p className="mt-1 mb-4 text-sm text-fg-sub">
        금칙어가 들어간 글 · 댓글은 올라가지 않고, 쓴 사람에게 어떤 말 때문인지 알려 줘요. 운영진은 검열을 받지 않아요 (공지에 금칙어를 적을 수 있게).
      </p>
      <form className="flex gap-2 mb-3" onSubmit={add}>
        <input
          className={cn(ui.input, 'flex-1')}
          value={word}
          maxLength={30}
          placeholder="금칙어 (예: 광고, 홍보 링크)"
          aria-label="금칙어"
          onChange={(e) => setWord(e.target.value)}
        />
        <button type="submit" className={cn(ui.button, ui.secondary, ui.small, 'self-end')} disabled={!word.trim() || words.length >= 50}>
          추가
        </button>
      </form>
      {words.length > 0 ? (
        <ul className="flex flex-wrap gap-2 m-0 mb-4 p-0 list-none">
          {words.map((w) => (
            <li key={w} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-sm bg-field text-sm font-semibold text-fg">
              {w}
              <button
                type="button"
                className="w-6 h-6 grid place-items-center rounded-sm text-fg-weak hover:text-fg-strong"
                aria-label={`${w} 빼기`}
                onClick={() => setWords(words.filter((x) => x !== w))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mb-4 text-sm text-fg-weak">금칙어가 없어요 (최대 50개)</p>
      )}
      <label className="flex items-center gap-2 text-[15px] text-fg">
        <input type="checkbox" checked={linkPolicy === 'staff'} onChange={(e) => setLinkPolicy(e.target.checked ? 'staff' : 'all')} />
        바깥 링크는 운영진만 올릴 수 있게 하기 <span className="text-[13px] text-fg-weak">(본문 사진은 괜찮아요)</span>
      </label>
      <div className="flex justify-end mt-4">
        <button
          type="button"
          className={cn(ui.button, ui.primary, ui.small)}
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({ bannedWords: words, linkPolicy }, { onSuccess: () => toast('자동 검열을 저장했어요'), onError: (e) => toast(e.message) })
          }
        >
          저장
        </button>
      </div>
    </section>
  );
}

const MEDAL = ['🥇', '🥈', '🥉'];
const seasonLabel = (season: string) => `${Number(season.slice(5))}월`;

function RankMark({ rank }: { rank: number }) {
  return <span className="w-7 flex-none text-center text-[15px] font-bold tabular-nums text-fg-sub">{MEDAL[rank - 1] ?? rank}</span>;
}

/** 채널 오른쪽: 이번 달 랭킹 상위 5명 */
export function RankingCard({ slug }: { slug: string }) {
  const { data } = useChannelRanking(slug);
  if (!data) return null;
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle}>{seasonLabel(data.season)} 랭킹</h2>
        <Link to={`/c/${slug}/ranking`} className={ui.cardLink} onPointerEnter={preload.ranking}>
          전체 보기
        </Link>
      </div>
      {data.ranks.length === 0 ? (
        <p className="m-0 px-5 pb-5 text-sm text-fg-weak">이번 달 첫 활동의 주인공이 되어 보세요</p>
      ) : (
        <ol className="list-none m-0 px-3 pb-3">
          {data.ranks.slice(0, 5).map((r) => (
            <li key={r.user.id}>
              <Link to={`/u/${r.user.id}`} className="flex items-center gap-2.5 px-2 py-2 rounded-sm hover:bg-field">
                <RankMark rank={r.rank} />
                <UserAvatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={28} />
                <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-fg-strong">{r.user.nickname}</span>
                <span className="text-[13px] text-fg-weak tabular-nums">{r.score.toLocaleString()}점</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RankingTable({ rows, me }: { rows: ChannelRankRow[]; me?: string }) {
  return (
    <ol className="list-none m-0 p-0">
      {rows.map((r) => (
        <li key={r.user.id}>
          <Link
            to={`/u/${r.user.id}`}
            className={cn('flex items-center gap-3 px-4 py-3 border-b border-line hover:bg-field', r.user.id === me && 'bg-primary-weak')}
          >
            <RankMark rank={r.rank} />
            <UserAvatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={36} />
            <span className="flex-1 min-w-0">
              <b className="block truncate text-[15px] text-fg-strong">{r.user.nickname}</b>
              <span className="text-[13px] text-fg-weak">
                글 {r.posts} · 댓글 {r.comments} · 받은 공감 {r.likes}
              </span>
            </span>
            <b className="text-[16px] tabular-nums text-fg-strong">{r.score.toLocaleString()}점</b>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** 랭킹 페이지에서 쓰는 내 정보 */
export const useMyUid = () => useAuth().user?.id;
