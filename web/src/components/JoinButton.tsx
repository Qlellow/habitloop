import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useBookmark, useMembership, type ChannelDetail } from '@loop/shared';
import { toast } from './Toast';
import ui from './ui.module.css';

/**
 * 채널 가입/탈퇴 버튼.
 * 가입 전: "가입하기" (비로그인이면 로그인으로), 가입 후: "가입됨" → 누르면 탈퇴 확인.
 * 채널을 만든 사람은 탈퇴할 수 없으므로 버튼을 보여 주지 않는다.
 */
export function JoinButton({
  channel,
  size,
  joinLabel = '가입하기',
  onJoined,
}: {
  channel: ChannelDetail;
  size?: 'small' | 'large';
  joinLabel?: string;
  onJoined?: () => void;
}) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const membership = useMembership(channel.slug);
  const sizeClass = size === 'small' ? ui.small : size === 'large' ? ui.large : '';

  if (channel.mine) return null;

  if (!channel.joined) {
    return (
      <button
        type="button"
        className={`${ui.button} ${ui.primary} ${sizeClass}`}
        disabled={membership.isPending}
        onClick={() => {
          if (!isLoggedIn) return navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
          membership.mutate(true, {
            onSuccess: () => {
              toast(`${channel.name} 채널에 가입했어요`);
              onJoined?.();
            },
            onError: (e) => toast(e.message),
          });
        }}
      >
        {joinLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${ui.button} ${ui.ghost} ${sizeClass}`}
      title="누르면 탈퇴할 수 있어요"
      disabled={membership.isPending}
      onClick={() => {
        if (!confirm(`'${channel.name}' 채널에서 탈퇴할까요?\n탈퇴하면 이 채널에 글을 쓸 수 없어요. (보기·댓글은 계속 가능해요)`)) return;
        membership.mutate(false, {
          onSuccess: () => toast('채널에서 탈퇴했어요'),
          onError: (e) => toast(e.message),
        });
      }}
    >
      ✓ 가입됨
    </button>
  );
}

/** 채널 북마크 (가입과 별개). 비로그인이면 로그인으로. */
export function BookmarkButton({ channel }: { channel: ChannelDetail }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const bookmark = useBookmark(channel.slug);
  const on = channel.bookmarked;
  return (
    <button
      type="button"
      className={`${ui.button} ${ui.ghost}`}
      aria-pressed={on}
      title={on ? '북마크 해제' : '북마크'}
      style={on ? { color: 'var(--primary)' } : undefined}
      onClick={() => {
        if (!isLoggedIn) return navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
        bookmark.mutate(!on, {
          onSuccess: () => toast(on ? '북마크를 해제했어요' : '북마크했어요. 마이페이지에서 모아 볼 수 있어요'),
          onError: (e) => toast(e.message),
        });
      }}
    >
      {on ? '★' : '☆'} 북마크
    </button>
  );
}
