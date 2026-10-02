import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  compact,
  timeAgo,
  useAddComment,
  useAuth,
  useBestComments,
  useChannel,
  useComments,
  useDeleteComment,
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
import { HeartIcon } from '../components/Icons';
import { Page } from '../components/Layout';
import { RoleBadge } from '../components/RoleBadge';
import { Markdown } from '../components/Markdown';
import { CollapsibleBody } from '../components/CollapsibleBody';
import { PopularCard } from '../components/Sidebar';
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

function CommentItem({ comment: c, postId, best }: { comment: Comment; postId: number; best?: boolean }) {
  const { isLoggedIn } = useAuth();
  const toLogin = useLoginRedirect(postId);
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  const onLike = () => {
    if (!isLoggedIn) return toLogin();
    like.mutate({ commentId: c.id, like: !c.liked }, { onError: (e) => toast(e.message) });
  };
  return (
    <li className={s.comment}>
      <div className={s.commentHead}>
        {best && <span className={s.bestBadge}>BEST</span>}
        <span className={s.commentAuthor}>
          {c.authorNickname}
          <RoleBadge role={c.authorRole} size={16} />
        </span>
        <time className={s.commentTime} dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
          {timeAgo(c.createdAt)}
        </time>
      </div>
      <p className={s.commentBody}>{c.content}</p>
      <div className={s.commentActions}>
        <button
          type="button"
          className={s.commentLike}
          aria-pressed={c.liked}
          aria-label={`좋아요 ${c.likeCount}`}
          onClick={onLike}
        >
          <HeartIcon filled={c.liked} />
          {c.likeCount > 0 ? compact(c.likeCount) : '좋아요'}
        </button>
        {c.deletable && !best && (
          <button
            type="button"
            className={s.commentDelete}
            onClick={() =>
              confirm(c.mine ? '댓글을 삭제할까요?' : `${c.authorNickname}님의 댓글을 운영진 권한으로 삭제할까요?`) &&
              remove.mutate(c.id, { onError: (e) => toast(e.message) })
            }
          >
            삭제
          </button>
        )}
      </div>
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

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    add.mutate(content, { onSuccess: () => setText(''), onError: (err) => toast(err.message) });
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
            aria-label="댓글"
          />
          <div className={s.composerFoot}>
            {/* 폰·터치 기기에는 키보드 단축키가 없으므로 숨긴다 */}
            <span className="max-[520px]:hidden [@media(pointer:coarse)]:hidden">Ctrl + Enter 로 등록</span>
            <button type="submit" className={cn(ui.button, ui.primary)} disabled={!text.trim() || add.isPending}>
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

  if (!Number.isInteger(id) || (error instanceof ApiError && error.status === 404)) {
    return <NotFoundPage message="삭제되었거나 없는 글이에요" />;
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
            <h1 className={s.title}>{post.title}</h1>
            <div className={s.byline}>
              <span className={s.avatar} aria-hidden>
                {post.author.nickname.slice(0, 1)}
              </span>
              <div>
                <div className={s.bylineName}>
                  {post.author.nickname}
                  <RoleBadge role={post.author.role} />
                </div>
                <div className={s.bylineMeta}>
                  <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>
                    {timeAgo(post.createdAt)}
                  </time>{' '}
                  · 조회 {compact(post.viewCount)}
                </div>
              </div>
              {(post.mine || post.canModerate) && !isPlaceholderData && (
                <div className={s.bylineActions}>
                  {post.mine && (
                    <Link to={`/posts/${id}/edit`} className={cn(ui.button, ui.text, ui.small)}>
                      수정
                    </Link>
                  )}
                  <button type="button" className={cn(ui.button, ui.text, ui.small, ui.danger)} onClick={onDelete}>
                    삭제
                  </button>
                </div>
              )}
            </div>
            <div className={s.content}>
              {isPlaceholderData ? (
                <>
                  <div className={ui.skeleton} style={{ width: '100%', height: 18 }} />
                  <div className={ui.skeleton} style={{ width: '90%', height: 18, marginTop: 10 }} />
                  <div className={ui.skeleton} style={{ width: '60%', height: 18, marginTop: 10 }} />
                </>
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
