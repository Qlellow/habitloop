import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { compact, REACTIONS, useAuth, useToggleLike, useToggleReaction, type PostDetail, type ReactionKind } from '@loop/shared';
import { HeartIcon } from './Icons';
import { toast } from './Toast';
import { cn } from '../lib/cn';

/**
 * 좋아요 + 감정 반응. 반응마다 누를 때 버튼의 움직임과 튀어나오는 것이 다르다 (global.css .rx-*)
 *   좋아요: 하트가 두근두근, 작은 하트가 떠오른다
 *   응원해요 👏: 짝짝 손뼉, 박수 선이 퍼진다
 *   웃겨요 😂: 데굴데굴 흔들리며 눈물이 양옆으로 튄다
 *   놀라워요 😮: 펄쩍 커지고 위에 ! 가 솟는다
 *   슬퍼요 😢: 버튼이 축 처지고 눈물이 뚝
 *   최고예요 🔥: 활활 일렁이고 불티가 솟고 버튼이 달아오른다
 */

type Anim = ReactionKind | 'like';

/** 튀어나오는 작은 조각들. dx, dy: 날아갈 방향 (px) */
const BITS: Record<Anim, { text: string; cls: string; dx: number; dy: number; delay?: number }[]> = {
  like: [
    { text: '♥', cls: 'rx-bit-heart', dx: -14, dy: -26 },
    { text: '♥', cls: 'rx-bit-heart', dx: 2, dy: -34, delay: 60 },
    { text: '♥', cls: 'rx-bit-heart', dx: 16, dy: -24, delay: 120 },
  ],
  clap: Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + ((i - 2.5) / 6) * Math.PI * 1.2;
    return { text: '', cls: 'rx-bit-line', dx: Math.cos(a) * 20, dy: Math.sin(a) * 20 };
  }),
  laugh: [
    { text: '', cls: 'rx-bit-drop', dx: -18, dy: -6 },
    { text: '', cls: 'rx-bit-drop', dx: 18, dy: -6, delay: 40 },
    { text: '', cls: 'rx-bit-drop', dx: -14, dy: 2, delay: 220 },
    { text: '', cls: 'rx-bit-drop', dx: 14, dy: 2, delay: 260 },
  ],
  wow: [{ text: '!', cls: 'rx-bit-bang', dx: 0, dy: -26 }],
  sad: [{ text: '', cls: 'rx-bit-tear', dx: 6, dy: 18, delay: 180 }],
  fire: [
    { text: '', cls: 'rx-bit-spark', dx: -10, dy: -24 },
    { text: '', cls: 'rx-bit-spark', dx: 4, dy: -32, delay: 90 },
    { text: '', cls: 'rx-bit-spark', dx: 12, dy: -20, delay: 160 },
    { text: '', cls: 'rx-bit-spark', dx: -3, dy: -28, delay: 240 },
  ],
};

function Bits({ anim }: { anim: Anim }) {
  return (
    <span className="rx-bits" aria-hidden>
      {BITS[anim].map((b, i) => (
        <span
          key={i}
          className={cn('rx-bit', b.cls)}
          style={{ '--dx': `${b.dx}px`, '--dy': `${b.dy}px`, animationDelay: `${b.delay ?? 0}ms` } as CSSProperties}
        >
          {b.text}
        </span>
      ))}
    </span>
  );
}

/** 누를 때마다 애니메이션을 처음부터 다시 (key 를 바꿔 다시 그린다) */
function usePlay() {
  const [play, setPlay] = useState<{ n: number; on: boolean }>({ n: 0, on: true });
  return [play, (on: boolean) => setPlay((p) => ({ n: p.n + 1, on }))] as const;
}

function AnimatedButton({
  anim,
  active,
  className,
  label,
  onPress,
  icon,
  children,
}: {
  anim: Anim;
  active: boolean;
  className: string;
  label: string;
  onPress: () => boolean;
  icon: ReactNode;
  children?: ReactNode;
}) {
  const [play, replay] = usePlay();
  const animClass = play.n ? (play.on ? `rx-play rx-${anim}` : 'rx-play rx-off') : '';
  const on = play.n > 0 && play.on;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(className, 'rx-button')}
      onClick={() => {
        const turnedOn = !active;
        if (onPress()) replay(turnedOn);
      }}
    >
      {/* 안쪽만 다시 그려 애니메이션을 처음부터 (버튼은 그대로 두어 키보드 포커스를 잃지 않게) */}
      {on && <span key={`glow${play.n}`} className={cn('rx-glow', `rx-glow-${anim}`)} aria-hidden />}
      <span key={play.n} className={cn('rx-inner', on && `rx-btn-${anim}`)}>
        <span className="rx-icon-wrap">
          <span className={cn('rx-icon', animClass)}>{icon}</span>
          {on && <Bits anim={anim} />}
        </span>
        {children}
      </span>
    </button>
  );
}

/** 좋아요 버튼 (게시글 미니 창에서도 쓴다) */
export function LikeButton({ post }: { post: PostDetail }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleLike(post.id);
  return (
    <AnimatedButton
      anim="like"
      active={post.liked}
      label={`좋아요 ${post.likeCount}`}
      className="rx-like-btn"
      icon={<HeartIcon filled={post.liked} />}
      onPress={() => {
        if (!isLoggedIn) {
          navigate('/login', { state: { from: `/posts/${post.id}` } });
          return false;
        }
        toggle.mutate(!post.liked, { onError: (e) => toast(e.message) });
        return true;
      }}
    >
      <span>좋아요 {compact(post.likeCount)}</span>
    </AnimatedButton>
  );
}

/** 감정 반응 줄 */
export function ReactionBar({ post }: { post: PostDetail }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleReaction(post.id);
  const mine = new Set(post.myReactions ?? []);
  return (
    <div className="rx-bar" role="group" aria-label="감정 반응">
      {REACTIONS.map((r) => {
        const count = post.reactions?.[r.kind] ?? 0;
        const active = mine.has(r.kind);
        return (
          <AnimatedButton
            key={r.kind}
            anim={r.kind}
            active={active}
            label={`${r.label} ${count}`}
            className="rx-chip"
            icon={<span className="rx-emoji">{r.emoji}</span>}
            onPress={() => {
              if (!isLoggedIn) {
                navigate('/login', { state: { from: `/posts/${post.id}` } });
                return false;
              }
              toggle.mutate({ kind: r.kind, on: !active }, { onError: (e) => toast(e.message) });
              return true;
            }}
          >
            <span>{r.label}</span>
            {count > 0 && <span className="rx-count">{compact(count)}</span>}
          </AnimatedButton>
        );
      })}
    </div>
  );
}
