import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, compact, isUserId, useAuth, useBlockUser, useFeed, useUserProfile, type Badge, type UserProfile } from '@loop/shared';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import { ui } from '../components/ui';
import { ProfileBanner } from '../components/ProfileBanner';
import { UserAvatar } from '../components/UserAvatar';
import { cn } from '../lib/cn';
import NotFoundPage from './NotFoundPage';

const joinedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 가입`;
};

/** 배지 종류마다 아이콘 (code 앞부분으로 고른다) */
const BADGE_ICON: [string, string][] = [
  ['post', '✍️'],
  ['first_post', '✍️'],
  ['comment', '💬'],
  ['first_comment', '💬'],
  ['likes', '❤️'],
  ['streak', '📅'],
  ['invite', '🤝'],
  ['channel', '📢'],
  ['followers', '👥'],
];
const badgeIcon = (code: string) => BADGE_ICON.find(([p]) => code.startsWith(p))?.[1] ?? '🏅';
const earnedOn = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 달성`;
};

/** 받은 배지(도전과제): 누구나 볼 수 있다 */
function Badges({ badges }: { badges: Badge[] }) {
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle}>
          배지 <span className="text-fg-weak font-semibold">{badges.length}</span>
        </h2>
      </div>
      {badges.length === 0 ? (
        <p className="m-0 px-5 pb-5 text-sm text-fg-weak">아직 받은 배지가 없어요</p>
      ) : (
        <ul className="list-none m-0 px-5 pb-5 grid grid-cols-3 gap-2.5 max-[720px]:grid-cols-2 max-[420px]:grid-cols-1">
          {badges.map((b) => (
            <li key={b.code} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5" title={`${b.description} · ${earnedOn(b.earnedAt)}`}>
              <span className="flex-none grid place-items-center w-10 h-10 rounded-full bg-primary-weak text-[20px]" aria-hidden>
                {badgeIcon(b.code)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-fg-strong truncate">{b.name}</div>
                <div className="text-[12px] text-fg-weak truncate">{b.description}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 차단 · 차단 해제 버튼 (로그인했고 내 프로필이 아닐 때) */
function BlockButton({ user }: { user: UserProfile }) {
  const block = useBlockUser();
  const [asking, setAsking] = useState(false);
  const run = (on: boolean) =>
    block.mutate(
      { userId: user.id, block: on },
      { onSuccess: () => toast(on ? `${user.nickname}님을 차단했어요` : '차단을 풀었어요'), onError: (e) => toast(e.message) },
    );
  return (
    <>
      <button
        type="button"
        className={cn(ui.button, ui.small, user.blocked ? ui.secondary : cn(ui.ghost, 'text-danger-text'))}
        disabled={block.isPending}
        onClick={() => (user.blocked ? run(false) : setAsking(true))}
      >
        {user.blocked ? '차단 해제' : '차단'}
      </button>
      <ConfirmDialog
        open={asking}
        title={`${user.nickname}님을 차단할까요?`}
        message="이 사람의 글은 내 목록에서 빠지고, 댓글은 가려지고, 이 사람 때문에 오는 알림도 받지 않아요. 상대에게는 알리지 않아요."
        confirmLabel="차단"
        danger
        onConfirm={() => {
          setAsking(false);
          run(true);
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}

/** 작성자 프로필: 닉네임 · 가입일 · 글/댓글 수 + 쓴 글 목록 */
export default function UserPage() {
  const id = useParams().id ?? '';
  const profile = useUserProfile(id);
  const feed = useFeed({ authorId: id }, isUserId(id));
  const { user: me } = useAuth();

  if (!isUserId(id) || (profile.error instanceof ApiError && profile.error.status === 404)) {
    return <NotFoundPage message="없는 사용자예요" />;
  }
  const user = profile.data;
  return (
    <Page variant="single">
      <section className={cn(ui.card, 'overflow-hidden')}>
        {/* 배너 위에 프로필 사진이 살짝 겹친다 */}
        <ProfileBanner banner={user?.banner} />
        {user ? (
          <div className="flex items-end gap-4 px-6 pb-6">
            <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={88} className="-mt-11 ring-4 ring-[var(--surface)]" />
            <div className="min-w-0 pt-3">
              <h1 className="m-0 text-[22px] font-bold text-fg-strong truncate">{user.nickname}</h1>
              <p className="mt-1 mb-0 text-sm text-fg-sub">
                글 {compact(user.postCount)} · 댓글 {compact(user.commentCount)}
              </p>
              <p className="mt-0.5 mb-0 text-[13px] text-fg-weak">{joinedAt(user.createdAt)}</p>
            </div>
            {me && me.id !== user.id && (
              <div className="ml-auto self-center pt-3">
                <BlockButton user={user} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 p-6" aria-hidden>
            <span className={ui.skeleton} style={{ width: 64, height: 64, borderRadius: 999 }} />
            <span className={ui.skeleton} style={{ width: 160, height: 24 }} />
          </div>
        )}
      </section>
      {user?.badges && <Badges badges={user.badges} />}
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h2 className={ui.sectionTitle}>쓴 글</h2>
        </div>
        <PostList query={feed} empty={user?.blocked ? '차단한 사용자의 글은 보이지 않아요' : '아직 쓴 글이 없어요'} />
      </section>
    </Page>
  );
}
