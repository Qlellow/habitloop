import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  useAddComment,
  useBestComments,
  useComments,
  useDeleteComment,
  useDeletePost,
  usePost,
  useToggleCommentLike,
  useToggleLike,
} from '../api/queries';
import type { Comment, PostDetail, PostSummary } from '../api/types';
import { useAuth } from '../auth/authStore';
import { HeartIcon } from '../components/Icons';
import { Main, SubHeader } from '../components/Layout';
import { Markdown } from '../components/Markdown';
import { toast } from '../components/Toast';
import { compact, timeAgo } from '../lib/format';
import { preload } from '../lib/preload';
import ui from '../components/ui.module.css';
import s from './PostDetail.module.css';
import NotFoundPage from './NotFoundPage';

function LikeButton({ post }: { post: PostDetail }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleLike(post.id);
  const onClick = () => {
    if (!isLoggedIn) return navigate(`/login?next=/posts/${post.id}`);
    toggle.mutate(!post.liked, { onError: (e) => toast(e.message) });
  };
  return (
    <button type="button" className={s.likeButton} aria-pressed={post.liked} onClick={onClick}>
      <HeartIcon filled={post.liked} />
      좋아요 {post.likeCount > 0 && compact(post.likeCount)}
    </button>
  );
}

function CommentItem({ comment: c, postId, best }: { comment: Comment; postId: number; best?: boolean }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  const onLike = () => {
    if (!isLoggedIn) return navigate(`/login?next=/posts/${postId}`);
    like.mutate({ commentId: c.id, like: !c.liked }, { onError: (e) => toast(e.message) });
  };
  return (
    <li className={`${s.comment} ${best ? s.best : ''}`}>
      <div className={s.commentHead}>
        {best && <span className={s.bestBadge}>BEST</span>}
        <span className={s.commentAuthor}>{c.authorNickname}</span>
        <time className={s.commentTime} dateTime={c.createdAt}>
          {timeAgo(c.createdAt)}
        </time>
        {c.mine && !best && (
          <button
            type="button"
            className={s.commentDelete}
            onClick={() => confirm('댓글을 삭제할까요?') && remove.mutate(c.id)}
          >
            삭제
          </button>
        )}
      </div>
      <p className={s.commentBody}>{c.content}</p>
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
    </li>
  );
}

function BestComments({ postId }: { postId: number }) {
  const { data } = useBestComments(postId);
  if (!data || data.length === 0) return null;
  return (
    <ul className={s.bestList} aria-label="베스트 댓글">
      {data.map((c) => (
        <CommentItem key={c.id} comment={c} postId={postId} best />
      ))}
    </ul>
  );
}

function Comments({ postId, count }: { postId: number; count?: number }) {
  const { isLoggedIn } = useAuth();
  const query = useComments(postId);
  const add = useAddComment(postId);
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    add.mutate(content, {
      onSuccess: () => setText(''),
      onError: (err) => toast(err.message),
    });
  };

  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className={`${ui.card} ${s.comments}`}>
      <h2 className={ui.sectionTitle} style={{ fontSize: 16 }}>
        댓글 {count ? <span style={{ color: 'var(--primary)' }}>{count}</span> : null}
      </h2>
      <BestComments postId={postId} />
      {query.isPending ? (
        <div className={ui.spinner} />
      ) : comments.length === 0 ? (
        <div className={ui.empty} style={{ padding: '24px 20px 32px' }}>
          첫 댓글을 남겨 보세요
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 8px' }}>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} postId={postId} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            type="button"
            className={`${ui.button} ${ui.ghost} ${ui.small}`}
            style={{ width: '100%' }}
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            댓글 더 보기
          </button>
        </div>
      )}
      <div className={ui.bottomCta}>
        {isLoggedIn ? (
          <form className={s.composer} onSubmit={submit}>
            <label htmlFor="comment" className="sr-only">
              댓글
            </label>
            <textarea
              id="comment"
              className={ui.textarea}
              rows={1}
              maxLength={1000}
              placeholder="댓글을 남겨 보세요"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={!text.trim() || add.isPending}>
              등록
            </button>
          </form>
        ) : (
          <div>
            <Link
              to={`/login?next=/posts/${postId}`}
              className={`${ui.button} ${ui.secondary} ${ui.block}`}
              onPointerEnter={preload.login}
            >
              로그인하고 댓글 남기기
            </Link>
          </div>
        )}
      </div>
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
    if (!confirm('글을 삭제할까요?')) return;
    del.mutate(id, {
      onSuccess: () => {
        toast('글을 삭제했어요');
        navigate('/', { replace: true });
      },
      onError: (e) => toast(e.message),
    });
  };

  const actions = post?.mine && !isPlaceholderData && (
    <>
      <Link to={`/posts/${id}/edit`} className={s.headerAction} style={{ lineHeight: '36px' }}>
        수정
      </Link>
      <button type="button" className={`${s.headerAction} ${s.danger}`} onClick={onDelete}>
        삭제
      </button>
    </>
  );

  return (
    <>
      <SubHeader right={actions} />
      <Main>
        <article className={`${ui.card} ${s.article}`}>
          {!post ? (
            <>
              <div className={ui.skeleton} style={{ width: 40, height: 16 }} />
              <div className={ui.skeleton} style={{ width: '80%', height: 28, margin: '12px 0 24px' }} />
              <div className={ui.skeleton} style={{ width: '100%', height: 120 }} />
            </>
          ) : (
            <>
              <Link to={`/c/${post.channel.slug}`} className={s.category} onPointerEnter={preload.channel}>
                {post.channel.name} ›
              </Link>
              <h1 className={s.title}>{post.title}</h1>
              <div className={s.author}>
                <span className={s.avatar} aria-hidden>
                  {post.author.nickname.slice(0, 1)}
                </span>
                <div>
                  <div className={s.authorName}>{post.author.nickname}</div>
                  <div className={s.authorMeta}>
                    {timeAgo(post.createdAt)} · 조회 {compact(post.viewCount)}
                  </div>
                </div>
              </div>
              {isPlaceholderData ? (
                <div style={{ margin: '20px 0 28px' }}>
                  <div className={ui.skeleton} style={{ width: '100%', height: 18 }} />
                  <div className={ui.skeleton} style={{ width: '90%', height: 18, marginTop: 10 }} />
                  <div className={ui.skeleton} style={{ width: '60%', height: 18, marginTop: 10 }} />
                </div>
              ) : (
                <div className={s.content}>
                  <Markdown source={post.content} />
                </div>
              )}
              {!isPlaceholderData && <LikeButton post={post} />}
            </>
          )}
        </article>
        {Number.isInteger(id) && <Comments postId={id} count={post?.commentCount} />}
      </Main>
    </>
  );
}
