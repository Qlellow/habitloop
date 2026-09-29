import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useMembership, type ChannelDetail } from '@loop/shared';
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
