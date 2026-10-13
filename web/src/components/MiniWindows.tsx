import { lazy, Suspense, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ApiError, timeAgo, usePost } from '@loop/shared';
import { BAR_H, miniWindows, useMiniEnabled, useMiniWindows, type MiniWindow } from '../lib/miniWindows';
import { CloseIcon, ExpandIcon, MinimizeIcon, RestoreIcon } from './Icons';
import { Markdown } from './Markdown';
import { RoleBadge } from './RoleBadge';
import { UserAvatar } from './UserAvatar';
import { ui } from './ui';
import { cn } from '../lib/cn';

// 공감 · 댓글은 글 화면의 것을 그대로 쓴다 (작은 창을 처음 열 때 받는다)
const LikeButton = lazy(() => import('../pages/PostDetailPage').then((m) => ({ default: m.LikeButton })));
const Comments = lazy(() => import('../pages/PostDetailPage').then((m) => ({ default: m.Comments })));

const barButton =
  'grid place-items-center w-7 h-7 rounded-sm text-fg-sub transition-colors hover:bg-field hover:text-fg-strong [&>svg]:w-4 [&>svg]:h-4';

/** 끌기: 누른 곳에서 움직인 만큼 onMove 로 알려 준다 (창 밖으로 나가도 계속 따라온다) */
function useDrag(onMove: (dx: number, dy: number) => void) {
  return (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

/** 미니 창 안의 글: 제목 · 작성자 · 본문 · 공감 · 댓글 (댓글도 여기서 쓸 수 있다) */
function MiniPost({ postId }: { postId: number }) {
  const { data: post, error, isPlaceholderData } = usePost(postId);
  if (error) {
    const message = error instanceof ApiError && (error.status === 403 || error.status === 404) ? error.message : '글을 불러오지 못했어요';
    return <p className={cn(ui.empty, 'py-10')}>{message}</p>;
  }
  if (!post) return <div className={ui.spinner} />;
  return (
    <article className="px-5 pt-4 pb-5">
      <div className="text-[13px] font-semibold text-primary">
        {post.channel.name}
        {post.category && <span className="text-fg-weak font-medium"> › {post.category.name}</span>}
      </div>
      <h2 className="mt-1 mb-2 text-lg font-bold leading-snug text-fg-strong break-words">{post.title}</h2>
      <div className="flex items-center gap-2 text-[13px] text-fg-sub">
        <UserAvatar nickname={post.author.nickname} avatarUrl={post.author.avatarUrl} size={22} />
        <span className="font-semibold text-fg">{post.author.nickname}</span>
        <RoleBadge role={post.author.role} size={14} />
        <span className="text-fg-weak">· {timeAgo(post.createdAt)}</span>
      </div>
      <div className="mt-4 pt-4 border-t border-line">
        {isPlaceholderData ? (
          <>
            <div className={ui.skeleton} style={{ width: '100%', height: 16 }} />
            <div className={ui.skeleton} style={{ width: '80%', height: 16, marginTop: 8 }} />
          </>
        ) : post.blockedAuthor ? (
          <p className="m-0 py-6 text-center text-sm text-fg-sub">차단한 사용자의 글이에요</p>
        ) : (
          <Markdown source={post.content} className="text-[15px]" />
        )}
      </div>
      {!isPlaceholderData && (
        <Suspense fallback={<div className={ui.spinner} />}>
          <div className="flex justify-center mt-6">
            <LikeButton post={post} />
          </div>
          <div className="-mx-5 mt-5">
            <Comments postId={post.id} count={post.commentCount} embedded />
          </div>
        </Suspense>
      )}
    </article>
  );
}

function Window({ win, title, layer, active }: { win: MiniWindow; title?: string; layer: number; active: boolean }) {
  const navigate = useNavigate();
  const start = useRef(win);
  const begin = (e: ReactPointerEvent) => {
    start.current = win;
    miniWindows.focus(win.postId);
    return e;
  };
  const drag = useDrag((dx, dy) => miniWindows.update(win.postId, { x: start.current.x + dx, y: start.current.y + dy }));
  const resize = useDrag((dx, dy) => miniWindows.update(win.postId, { w: start.current.w + dx, h: start.current.h + dy }));
  const height = win.minimized ? BAR_H : win.h;

  return (
    <section
      role="dialog"
      aria-label={`작은 창: ${title ?? '게시글'}`}
      onPointerDown={() => miniWindows.focus(win.postId)}
      // 사이트 헤더(z-30)보다 위, 팝업 · 알림 메시지(z-50)보다 아래. 나중에 누른 창이 위로
      className="fixed flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop animate-pop"
      style={{ left: win.x, top: win.y, width: win.w, height, zIndex: 31 + layer }}
    >
      {/* 제목 줄: 끌어서 옮기기, 두 번 누르면 접기/펼치기 */}
      <header
        className="flex-none flex items-center gap-1 h-11 pl-4 pr-1.5 border-b border-line bg-pressed cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          drag(begin(e));
        }}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && miniWindows.update(win.postId, { minimized: !win.minimized })}
      >
        <span className={cn('flex-1 min-w-0 truncate text-sm font-semibold', active ? 'text-fg-strong' : 'text-fg-sub')}>{title ?? '불러오는 중…'}</span>
        <button
          type="button"
          className={barButton}
          aria-label={win.minimized ? '펼치기' : '접기'}
          title={win.minimized ? '펼치기' : '접기'}
          onClick={() => miniWindows.update(win.postId, { minimized: !win.minimized })}
        >
          {win.minimized ? <RestoreIcon /> : <MinimizeIcon />}
        </button>
        <button
          type="button"
          className={barButton}
          aria-label="글 페이지로 크게 보기"
          title="글 페이지로 크게 보기"
          onClick={() => {
            miniWindows.close(win.postId);
            navigate(`/posts/${win.postId}`);
          }}
        >
          <ExpandIcon />
        </button>
        <button type="button" className={barButton} aria-label="닫기" title="닫기" onClick={() => miniWindows.close(win.postId)}>
          <CloseIcon />
        </button>
      </header>
      {!win.minimized && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <MiniPost postId={win.postId} />
          </div>
          {/* 오른쪽 아래 모서리를 끌어서 크기 바꾸기 */}
          <div
            aria-hidden
            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize touch-none"
            style={{ background: 'linear-gradient(135deg, transparent 50%, var(--border) 50%, var(--border) 60%, transparent 60%, transparent 70%, var(--border) 70%, var(--border) 80%, transparent 80%)' }}
            onPointerDown={(e) => resize(begin(e))}
          />
        </>
      )}
    </section>
  );
}

/** 창 제목은 글 제목 (캐시에 있으면 바로, 없으면 불러온 뒤) */
function WindowWithTitle({ win, layer, active }: { win: MiniWindow; layer: number; active: boolean }) {
  const { data } = usePost(win.postId);
  return <Window win={win} title={data?.title} layer={layer} active={active} />;
}

/**
 * 열린 미니 창들. 사이트 어디서든(화면을 옮겨도) 떠 있고, 끌어서 옮기고 · 모서리로 크기를 바꾸고 · 접을 수 있다.
 * 좁은 화면 · 터치 기기에서는 보이지 않는다
 */
export function MiniWindows() {
  const enabled = useMiniEnabled();
  const list = useMiniWindows();

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => miniWindows.fitAll();
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  if (!enabled || list.length === 0) return null;
  // 쌓인 순서 (0 = 맨 아래). DOM 순서는 그대로 두어 창을 누를 때 다시 그려지지 않게 한다
  const order = [...list].sort((a, b) => a.z - b.z).map((w) => w.postId);
  return createPortal(
    <>
      {list.map((w) => {
        const layer = order.indexOf(w.postId);
        return <WindowWithTitle key={w.postId} win={w} layer={layer} active={layer === order.length - 1} />;
      })}
    </>,
    document.body,
  );
}
