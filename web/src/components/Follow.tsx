import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { compact, useAuth, useFollowList, useFollowUser, type UserProfile } from '@loop/shared';
import { CloseIcon } from './Icons';
import { Modal, useEscape } from './Modal';
import { toast } from './Toast';
import { ui } from './ui';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/cn';

/** 프로필: 팔로워 · 팔로잉 수 (누르면 목록) */
export function FollowCounts({ user }: { user: UserProfile }) {
  const [open, setOpen] = useState<'followers' | 'following'>();
  return (
    <>
      <span className="inline-flex gap-3">
        <button type="button" className="hover:text-fg-strong" onClick={() => setOpen('followers')}>
          팔로워 <b className="text-fg-strong">{compact(user.followerCount ?? 0)}</b>
        </button>
        <button type="button" className="hover:text-fg-strong" onClick={() => setOpen('following')}>
          팔로잉 <b className="text-fg-strong">{compact(user.followingCount ?? 0)}</b>
        </button>
      </span>
      {open && <FollowListDialog userId={user.id} nickname={user.nickname} kind={open} onKind={setOpen} onClose={() => setOpen(undefined)} />}
    </>
  );
}

function FollowListDialog({
  userId,
  nickname,
  kind,
  onKind,
  onClose,
}: {
  userId: string;
  nickname: string;
  kind: 'followers' | 'following';
  onKind: (k: 'followers' | 'following') => void;
  onClose: () => void;
}) {
  const list = useFollowList(userId, kind);
  useEscape(onClose);
  return (
    <Modal onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${nickname}님의 ${kind === 'followers' ? '팔로워' : '팔로잉'}`}
        className="w-full max-w-[400px] rounded-xl border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className={ui.tabs} role="tablist">
            <button type="button" role="tab" className={ui.tab} aria-selected={kind === 'followers'} onClick={() => onKind('followers')}>
              팔로워
            </button>
            <button type="button" role="tab" className={ui.tab} aria-selected={kind === 'following'} onClick={() => onKind('following')}>
              팔로잉
            </button>
          </div>
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'w-8 px-0')} aria-label="닫기" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {list.isPending ? (
            <div className={ui.spinner} />
          ) : !list.data?.length ? (
            <p className="m-0 px-4 py-8 text-center text-sm text-fg-weak">{kind === 'followers' ? '아직 팔로워가 없어요' : '아직 팔로우한 사람이 없어요'}</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {list.data.map((u) => (
                <li key={u.id}>
                  <Link to={`/u/${u.id}`} onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-field">
                    <UserAvatar nickname={u.nickname} avatarUrl={u.avatarUrl} size={36} />
                    <span className="truncate text-[15px] font-semibold text-fg-strong">{u.nickname}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** 프로필: 팔로우 · 쪽지 보내기 */
export function FollowActions({ user }: { user: UserProfile }) {
  const { isLoggedIn } = useAuth();
  const follow = useFollowUser(user.id);
  const navigate = useNavigate();
  if (!isLoggedIn || user.blocked) return null;
  return (
    <>
      <button
        type="button"
        className={cn(ui.button, ui.small, user.following ? ui.ghost : ui.primary)}
        disabled={follow.isPending}
        onClick={() =>
          follow.mutate(!user.following, {
            onSuccess: (r) =>
              toast(r.following ? `${user.nickname}님을 팔로우했어요 · 홈의 '팔로우한 사람' 글 목록에서 모아 볼 수 있어요` : '팔로우를 끊었어요'),
            onError: (e) => toast(e.message),
          })
        }
      >
        {user.following ? '팔로잉' : '팔로우'}
      </button>
      {user.canMessage && (
        <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => navigate(`/messages/${user.id}`)}>
          쪽지
        </button>
      )}
    </>
  );
}
