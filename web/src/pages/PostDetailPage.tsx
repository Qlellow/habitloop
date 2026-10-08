import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  apiUrl,
  compact,
  uploadPostImage,
  timeAgo,
  useAddComment,
  useAuth,
  useBestComments,
  useChannel,
  useComments,
  useDeleteComment,
  useEditComment,
  useDeletePost,
  usePost,
  useToggleCommentLike,
  useToggleLike,
  plainText,
  type Comment,
  type PostDetail,
  type PostSummary,
} from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { HeartIcon, ImageIcon } from '../components/Icons';
import { prepareUpload } from '../lib/postImage';
import { Page } from '../components/Layout';
import { RoleBadge } from '../components/RoleBadge';
import { UserAvatar } from '../components/UserAvatar';
import { Markdown } from '../components/Markdown';
import { CollapsibleBody } from '../components/CollapsibleBody';
import { PopularCard } from '../components/Sidebar';
import { ReportDialog } from '../components/ReportDialog';
import { toast } from '../components/Toast';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import s from './pages.styles';
import NotFoundPage from './NotFoundPage';
import { cn } from '../lib/cn';

function useLoginRedirect(postId: number) {
  const navigate = useNavigate();
  return () => navigate('/login', { state: { from: `/posts/${postId}` } });
}

function LikeButton({ post }: { post: PostDetail }) {
  const { isLoggedIn } = useAuth();
  const toLogin = useLoginRedirect(post.id);
  const toggle = useToggleLike(post.id);
  const onClick = () => {
    if (!isLoggedIn) return toLogin();
    toggle.mutate(!post.liked, { onError: (e) => toast(e.message) });
  };
  return (
    <button type="button" className={s.likeButton} aria-pressed={post.liked} onClick={onClick}>
      <HeartIcon filled={post.liked} />
      좋아요 {compact(post.likeCount)}
    </button>
  );
}

/** 댓글 하나에 붙일 수 있는 사진 수 */
const MAX_COMMENT_IMAGES = 4;

/** 댓글 안의 이미지 ![](주소): 글자는 그대로, 이미지는 작은 사진으로 (누르면 원본) */
const COMMENT_IMAGE = /!\[[^\]\n]*\]\((\/api\/images\/[A-Za-z0-9_-]{16,32})(?:#[^)\s]*)?\)/g;

function CommentBody({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const images: string[] = [];
  let last = 0;
  for (const m of content.matchAll(COMMENT_IMAGE)) {
    parts.push(content.slice(last, m.index));
    images.push(m[1]);
    last = m.index! + m[0].length;
  }
  parts.push(content.slice(last));
  const text = parts.join('').replace(/\n{3,}/g, '\n\n').trim();
  return (
    <>
      {text && <p className={s.commentBody}>{text}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 mb-3">
          {images.map((src, i) => (
            <a key={i} href={apiUrl(src)} target="_blank" rel="noopener noreferrer" className="block">
              <img src={apiUrl(src)} alt="" loading="lazy" className="block max-h-56 max-w-[min(100%,320px)] rounded-md border border-border object-cover" />
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/** 답글 쓰기 · 댓글 고치기 칸 (작게) */
function InlineComposer({
  initial = '',
  placeholder,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const submit = () => text.trim() && onSubmit(text.trim());
  return (
    <div className="mt-2 mb-1">
      <textarea
        className={cn(ui.textarea, 'min-h-[72px] text-[15px]')}
        maxLength={1000}
        placeholder={placeholder}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        aria-label={placeholder}
      />
      <div className="flex justify-end gap-1.5 mt-1.5">
        <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={onCancel}>
          취소
        </button>
        <button type="button" className={cn(ui.button, ui.primary, ui.small)} disabled={!text.trim() || pending} onClick={submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentItem({ comment: c, postId, best, reply }: { comment: Comment; postId: number; best?: boolean; reply?: boolean }) {
  const { isLoggedIn } = useAuth();
  const toLogin = useLoginRedirect(postId);
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  const edit = useEditComment(postId);
  const add = useAddComment(postId);
  const [mode, setMode] = useState<'edit' | 'reply'>();
  const [reporting, setReporting] = useState(false);
  // 운영진이 숨긴 댓글 · 내가 차단한 사람의 댓글: 내용이 비어 온다
  const masked = (!!c.hidden || !!c.blocked) && !c.content;
  const onLike = () => {
    if (!isLoggedIn) return toLogin();
    like.mutate({ commentId: c.id, like: !c.liked }, { onError: (e) => toast(e.message) });
  };
  return (
    <li className={reply ? 'pt-3' : s.comment}>
      <div className={s.commentHead}>
        {best && <span className={s.bestBadge}>BEST</span>}
        <Link to={`/u/${c.authorId}`} className={cn(s.commentAuthor, 'hover:underline underline-offset-2')} onPointerEnter={preload.user}>
          <UserAvatar nickname={c.authorNickname} avatarUrl={c.authorAvatar} size={reply ? 20 : 24} />
          {c.authorNickname}
          <RoleBadge role={c.authorRole} size={16} />
        </Link>
        <time className={s.commentTime} dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
          {timeAgo(c.createdAt)}
          {c.updatedAt && ' · 수정됨'}
        </time>
      </div>
      {mode === 'edit' ? (
        <InlineComposer
          initial={c.content}
          placeholder="댓글 고치기"
          submitLabel="저장"
          pending={edit.isPending}
          onCancel={() => setMode(undefined)}
          onSubmit={(content) => edit.mutate({ id: c.id, content }, { onSuccess: () => setMode(undefined), onError: (e) => toast(e.message) })}
        />
      ) : masked ? (
        <p className={cn(s.commentBody, 'text-fg-weak italic')}>{c.blocked ? '차단한 사용자의 댓글이에요' : '운영진이 숨긴 댓글이에요'}</p>
      ) : (
        <>
          {c.hidden && <span className={cn(ui.badge, 'mb-1.5 bg-danger-weak text-danger-text')}>숨겨진 댓글 · 쓴 사람과 운영진에게만 보여요</span>}
          <CommentBody content={c.content} />
        </>
      )}
      {mode !== 'edit' && !masked && (
        <div className={s.commentActions}>
          <button type="button" className={s.commentLike} aria-pressed={c.liked} aria-label={`좋아요 ${c.likeCount}`} onClick={onLike}>
            <HeartIcon filled={c.liked} />
            {c.likeCount > 0 ? compact(c.likeCount) : '좋아요'}
          </button>
          {!best && (
            <button
              type="button"
              className={s.commentAction}
              onClick={() => (isLoggedIn ? setMode(mode === 'reply' ? undefined : 'reply') : toLogin())}
            >
              답글
            </button>
          )}
          {c.mine && !best && (
            <button type="button" className={s.commentAction} onClick={() => setMode('edit')}>
              수정
            </button>
          )}
          {c.deletable && !best && (
            <button
              type="button"
              className={s.commentDelete}
              onClick={() =>
                confirm(
                  c.mine
                    ? reply || !c.replies?.length
                      ? '댓글을 삭제할까요?'
                      : `댓글을 삭제할까요?\n답글 ${c.replies.length}개도 함께 지워져요.`
                    : `${c.authorNickname}님의 댓글을 운영진 권한으로 삭제할까요?`,
                ) && remove.mutate(c.id, { onError: (e) => toast(e.message) })
              }
            >
              삭제
            </button>
          )}
          {isLoggedIn && !c.mine && !best && (
            <button type="button" className={s.commentAction} onClick={() => setReporting(true)}>
              신고
            </button>
          )}
        </div>
      )}
      {reporting && <ReportDialog postId={postId} commentId={c.id} onClose={() => setReporting(false)} />}
      {mode === 'reply' && (
        <InlineComposer
          placeholder={`${c.authorNickname}님에게 답글`}
          submitLabel="답글 등록"
          pending={add.isPending}
          onCancel={() => setMode(undefined)}
          onSubmit={(content) =>
            add.mutate({ content, parentId: c.id }, { onSuccess: () => setMode(undefined), onError: (e) => toast(e.message) })
          }
        />
      )}
      {/* 답글: 댓글 아래에 한 단계 들여서 */}
      {!reply && c.replies && c.replies.length > 0 && (
        <ul className="list-none m-0 mt-2 ml-3 pl-4 border-l-2 border-line" aria-label="답글">
          {c.replies.map((r) => (
            <CommentItem key={r.id} comment={r} postId={postId} reply />
          ))}
        </ul>
      )}
    </li>
  );
}

function Comments({ postId, count }: { postId: number; count?: number }) {
  const { isLoggedIn } = useAuth();
  const { pathname } = useLocation();
  const query = useComments(postId);
  const best = useBestComments(postId);
  const add = useAddComment(postId);
  const [text, setText] = useState('');
  // 댓글에 붙일 사진 (올린 주소). 등록하면 본문 뒤에 ![](주소) 로 붙는다
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const attach = (files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith('image/')).slice(0, MAX_COMMENT_IMAGES - images.length);
    if (files.length && !picked.length && images.length >= MAX_COMMENT_IMAGES) toast(`사진은 ${MAX_COMMENT_IMAGES}장까지 붙일 수 있어요`);
    for (const file of picked) {
      setUploading((n) => n + 1);
      prepareUpload(file)
        .then((blob) => uploadPostImage(blob))
        .then(({ url }) => setImages((list) => [...list, url].slice(0, MAX_COMMENT_IMAGES)))
        .catch((e: Error) => toast(e.message))
        .finally(() => setUploading((n) => n - 1));
    }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = [text.trim(), ...images.map((url) => `![](${url})`)].filter(Boolean).join('\n');
    if (!content || uploading) return;
    add.mutate(content, {
      onSuccess: () => {
        setText('');
        setImages([]);
      },
      onError: (err) => toast(err.message),
    });
  };

  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle}>
          댓글 {count ? <span style={{ color: 'var(--primary)' }}>{count}</span> : null}
        </h2>
      </div>
      {isLoggedIn ? (
        <form className={s.composer} onSubmit={submit}>
          <textarea
            className={ui.textarea}
            maxLength={1000}
            placeholder="댓글을 남겨 보세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault();
                attach(files);
              }
            }}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer.files);
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault();
                attach(files);
              }
            }}
            aria-label="댓글"
          />
          {(images.length > 0 || uploading > 0) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((url) => (
                <span key={url} className="relative">
                  <img src={apiUrl(url)} alt="" className="block w-20 h-20 rounded-md object-cover border border-border" />
                  <button
                    type="button"
                    aria-label="사진 빼기"
                    className="absolute -top-1.5 -right-1.5 grid place-items-center w-6 h-6 rounded-full bg-toast text-white text-xs"
                    onClick={() => setImages((list) => list.filter((u) => u !== url))}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <span key={`up-${i}`} className={cn(ui.skeleton, 'block w-20 h-20')} aria-label="사진 올리는 중" />
              ))}
            </div>
          )}
          <div className={s.composerFoot}>
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small, 'gap-1 !ml-0 [&>svg]:w-[18px] [&>svg]:h-[18px]')}
              onClick={() => fileRef.current?.click()}
              disabled={images.length + uploading >= MAX_COMMENT_IMAGES}
              title={`사진 붙이기 (최대 ${MAX_COMMENT_IMAGES}장, 붙여넣기·끌어다 놓기도 돼요)`}
            >
              <ImageIcon />
              사진
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                attach(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            {/* 폰·터치 기기에는 키보드 단축키가 없으므로 숨긴다 */}
            <span className="ml-3 max-[520px]:hidden [@media(pointer:coarse)]:hidden">Ctrl + Enter 로 등록</span>
            <button type="submit" className={cn(ui.button, ui.primary)} disabled={(!text.trim() && !images.length) || uploading > 0 || add.isPending}>
              등록
            </button>
          </div>
        </form>
      ) : (
        <p className={s.loginPrompt}>
          <Link to="/login" state={{ from: pathname }} onPointerEnter={preload.login}>
            로그인
          </Link>
          하고 댓글을 남겨 보세요
        </p>
      )}
      {best.data && best.data.length > 0 && (
        <ul className={s.bestList} aria-label="베스트 댓글">
          {best.data.map((c) => (
            <CommentItem key={c.id} comment={c} postId={postId} best />
          ))}
        </ul>
      )}
      {query.isPending ? (
        <div className={ui.spinner} />
      ) : comments.length === 0 ? (
        <div className={ui.empty} style={{ paddingTop: 24 }}>
          첫 댓글을 남겨 보세요
        </div>
      ) : (
        <ul className={s.comments}>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} postId={postId} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div style={{ padding: '4px 20px 20px' }}>
          <button
            type="button"
            className={cn(ui.button, ui.ghost, ui.full)}
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            댓글 더 보기
          </button>
        </div>
      )}
    </section>
  );
}

function ChannelCard({ slug }: { slug: string }) {
  const { data } = useChannel(slug);
  if (!data) return null;
  return (
    <section className={cn(ui.card, s.sideChannel)}>
      <div className={s.sideChannelTop}>
        <ChannelIcon channel={data} size={40} />
        <div>
          <div className={s.sideChannelName}>{data.name}</div>
          <div className={s.bannerSlug}>
            멤버 {compact(data.memberCount)}명 · 글 {compact(data.postCount)}개
          </div>
        </div>
      </div>
      {data.description && <p className={s.sideChannelDesc}>{plainText(data.description)}</p>}
      <Link to={`/c/${slug}`} className={cn(ui.button, ui.secondary, ui.full)} onPointerEnter={preload.channel}>
        채널로 가기
      </Link>
    </section>
  );
}

export default function PostDetailPage() {
  const id = Number(useParams().id);
  const summary = (useLocation().state as { summary?: PostSummary } | null)?.summary;
  const navigate = useNavigate();
  const { data: post, isPlaceholderData, error } = usePost(id, summary?.id === id ? summary : undefined);
  const del = useDeletePost();
  const { isLoggedIn } = useAuth();
  const [reporting, setReporting] = useState(false);
  // 내가 차단한 사람의 글은 내용을 접어 두고, 누르면 보여 준다
  const [shownBlocked, setShownBlocked] = useState<number>();
  const showBlocked = shownBlocked === id;

  if (!Number.isInteger(id) || (error instanceof ApiError && error.status === 404)) {
    return <NotFoundPage message="삭제되었거나 없는 글이에요" />;
  }
  // 운영진이 숨긴 글 · 볼 수 없는 채널의 글
  if (error instanceof ApiError && error.status === 403) {
    return <NotFoundPage message={error.message} hint="이 글은 지금 볼 수 없어요." />;
  }

  const onDelete = () => {
    if (!post || !confirm(post.mine ? '글을 삭제할까요?' : `${post.author.nickname}님의 글을 운영진 권한으로 삭제할까요?`)) return;
    del.mutate(id, {
      onSuccess: () => {
        toast('글을 삭제했어요');
        navigate(`/c/${post.channel.slug}`, { replace: true });
      },
      onError: (e) => toast(e.message),
    });
  };

  const slug = post?.channel.slug;

  return (
    <Page
      variant="twoRight"
      right={
        slug && (
          <>
            <ChannelCard slug={slug} />
            <PopularCard channel={slug} title="이 채널 인기글" />
          </>
        )
      }
    >
      <article className={cn(ui.card, s.article)}>
        {!post ? (
          <>
            <div className={ui.skeleton} style={{ width: 80, height: 16 }} />
            <div className={ui.skeleton} style={{ width: '70%', height: 32, margin: '14px 0 24px' }} />
            <div className={ui.skeleton} style={{ width: '100%', height: 160 }} />
          </>
        ) : (
          <>
            <nav className={s.crumbs} aria-label="위치">
              <Link to={`/c/${post.channel.slug}`} onPointerEnter={preload.channel}>
                {post.channel.name}
              </Link>
              {post.category && (
                <>
                  <span aria-hidden>›</span>
                  <Link to={`/c/${post.channel.slug}?category=${post.category.id}`}>{post.category.name}</Link>
                </>
              )}
            </nav>
            {post.hidden && (
              <p className="mt-3 mb-0 px-3.5 py-2.5 rounded-md bg-danger-weak text-sm font-medium text-danger-text">
                운영진이 숨긴 글이에요. 쓴 사람과 운영진에게만 보여요.
              </p>
            )}
            <h1 className={s.title}>{post.title}</h1>
            <div className={s.byline}>
              <Link to={`/u/${post.author.id}`} aria-label={`${post.author.nickname} 프로필`} onPointerEnter={preload.user}>
                <UserAvatar nickname={post.author.nickname} avatarUrl={post.author.avatarUrl} size={40} />
              </Link>
              <div>
                <Link to={`/u/${post.author.id}`} className={cn(s.bylineName, 'hover:underline underline-offset-2')} onPointerEnter={preload.user}>
                  {post.author.nickname}
                  <RoleBadge role={post.author.role} />
                </Link>
                <div className={s.bylineMeta}>
                  <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>
                    {timeAgo(post.createdAt)}
                  </time>{' '}
                  · 조회 {compact(post.viewCount)}
                </div>
              </div>
              {(post.mine || post.canModerate || isLoggedIn) && !isPlaceholderData && (
                <div className={s.bylineActions}>
                  {post.mine && (
                    <Link to={`/posts/${id}/edit`} className={cn(ui.button, ui.text, ui.small)}>
                      수정
                    </Link>
                  )}
                  {(post.mine || post.canModerate) && (
                    <button type="button" className={cn(ui.button, ui.text, ui.small, ui.danger)} onClick={onDelete}>
                      삭제
                    </button>
                  )}
                  {isLoggedIn && !post.mine && (
                    <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => setReporting(true)}>
                      신고
                    </button>
                  )}
                </div>
              )}
              {reporting && <ReportDialog postId={id} onClose={() => setReporting(false)} />}
            </div>
            <div className={s.content}>
              {isPlaceholderData ? (
                <>
                  <div className={ui.skeleton} style={{ width: '100%', height: 18 }} />
                  <div className={ui.skeleton} style={{ width: '90%', height: 18, marginTop: 10 }} />
                  <div className={ui.skeleton} style={{ width: '60%', height: 18, marginTop: 10 }} />
                </>
              ) : post.blockedAuthor && !showBlocked ? (
                <div className="flex flex-col items-center gap-3 py-10 rounded-md bg-field text-sm text-fg-sub">
                  차단한 사용자의 글이에요
                  <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setShownBlocked(id)}>
                    그래도 보기
                  </button>
                </div>
              ) : (
                <CollapsibleBody key={post.id}>
                  <Markdown source={post.content} />
                </CollapsibleBody>
              )}
            </div>
            {!isPlaceholderData && (
              <div className={s.reactions}>
                <LikeButton post={post} />
              </div>
            )}
          </>
        )}
      </article>
      {Number.isInteger(id) && <Comments postId={id} count={post?.commentCount} />}
    </Page>
  );
}
