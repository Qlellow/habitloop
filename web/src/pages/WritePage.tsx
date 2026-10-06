import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, useChannel, usePost, useSavePost, type ChannelDetail, type PostDetail } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { JoinButton } from '../components/JoinButton';
import { Page } from '../components/Layout';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import w from './WritePage.styles';
import { cn } from '../lib/cn';

/** 글은 채널 안에서만 쓴다. 채널은 들어온 곳으로 고정되고, 카테고리만 드롭다운으로 고른다. */
function PostForm({
  channel,
  initial,
  defaultCategory,
}: {
  channel: ChannelDetail;
  initial?: PostDetail;
  defaultCategory?: number;
}) {
  const navigate = useNavigate();
  const save = useSavePost(initial?.id);

  // 운영진 전용 카테고리는 항상 맨 위에. 운영진이 아니면 보이지만 고를 수 없다 (고르면 알림)
  const ordered = [...channel.categories.filter((c) => c.ownerOnly), ...channel.categories.filter((c) => !c.ownerOnly)];
  const canUse = (c: (typeof ordered)[number]) => !c.ownerOnly || channel.staff || c.id === initial?.category?.id;
  const needsCategory = ordered.length > 0;
  const initialCategory = initial
    ? (initial.category?.id ?? null)
    : (ordered.find((c) => c.id === defaultCategory && canUse(c))?.id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategory);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  // 카테고리가 있는 채널은 카테고리를 골라야 글을 올릴 수 있다
  const valid = title.trim().length > 0 && content.trim().length > 0 && (!needsCategory || categoryId != null);

  const options: DropdownOption<number | null>[] = ordered.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.ownerOnly ? <span className={ui.badge}>운영진 전용</span> : undefined,
  }));
  const pickCategory = (id: number | null) => {
    const c = ordered.find((x) => x.id === id);
    if (c && !canUse(c)) return toast(`'${c.name}'은 운영진만 글을 쓸 수 있는 카테고리예요`);
    setCategoryId(id);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { channel: channel.slug, categoryId, title: title.trim(), content },
      {
        onSuccess: (post) => {
          toast(initial ? '글을 수정했어요' : '글을 올렸어요');
          navigate(`/posts/${post.id}`, { replace: true });
        },
        onError: (err) => toast(err.message),
      },
    );
  };

  return (
    <>
      <div className={w.head}>
        <Link to={`/c/${channel.slug}`} className={w.channel}>
          <ChannelIcon channel={channel} size={40} />
          <span>
            <span className={w.channelName}>{channel.name}</span>
          </span>
        </Link>
        <h1 className={s.pageTitle}>{initial ? '글 수정' : '글쓰기'}</h1>
      </div>
      <form className={cn(ui.card, s.formCard)} onSubmit={submit}>
        {/* 카테고리(왼쪽) + 제목 */}
        <div className={w.titleRow}>
          {needsCategory && (
            <Dropdown
              label="카테고리"
              placeholder="카테고리 선택"
              value={categoryId}
              options={options}
              onChange={pickCategory}
              className={w.category}
            />
          )}
          <input
            className={cn(ui.input, w.title)}
            placeholder="제목을 입력해 주세요"
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="제목"
            autoFocus
          />
        </div>
        <MarkdownEditor value={content} onChange={setContent} />
        <div className={s.formFoot}>
          {needsCategory && categoryId == null && <span className="mr-auto text-sm text-fg-weak">카테고리를 골라 주세요</span>}
          <button type="button" className={cn(ui.button, ui.ghost)} onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || save.isPending}>
            {save.isPending ? '저장 중…' : initial ? '수정하기' : '올리기'}
          </button>
        </div>
      </form>
    </>
  );
}

/** 팔로우하지 않은 채널에서 글쓰기를 열면: 팔로우하면 바로 쓸 수 있게 안내 */
function JoinGate({ channel }: { channel: ChannelDetail }) {
  return (
    <div className={cn(ui.card, w.gate)}>
      <ChannelIcon channel={channel} size={56} />
      <h1 className={w.gateTitle}>{channel.name} 채널을 팔로우해야 글을 쓸 수 있어요</h1>
      <p className={w.gateDesc}>글 보기, 공감, 댓글은 팔로우하지 않아도 할 수 있어요.</p>
      <div className={w.gateActions}>
        <Link to={`/c/${channel.slug}`} className={cn(ui.button, ui.ghost, ui.large)}>
          채널로 돌아가기
        </Link>
        <JoinButton channel={channel} size="large" joinLabel="팔로우하고 글쓰기" />
      </div>
    </div>
  );
}

function NewPost({ slug, defaultCategory }: { slug: string; defaultCategory?: number }) {
  const { data: channel, isPlaceholderData, error } = useChannel(slug);
  if (error instanceof ApiError && error.status === 404) return <GoToChannels />;
  if (!channel || isPlaceholderData) return <div className={ui.spinner} />;
  // 팔로우하면 채널 캐시의 joined 가 바뀌면서 바로 글쓰기 화면으로 넘어간다
  if (!channel.joined) return <JoinGate channel={channel} />;
  return <PostForm channel={channel} defaultCategory={defaultCategory} />;
}

function EditPost({ id }: { id: number }) {
  const { data: post, isPending, isPlaceholderData, isError } = usePost(id);
  const { data: channel, isPlaceholderData: channelLoading } = useChannel(post?.channel.slug);
  if (isPending || isPlaceholderData) return <div className={ui.spinner} />;
  if (isError || !post.mine) return <Navigate to={`/posts/${id}`} replace />;
  if (!channel || channelLoading) return <div className={ui.spinner} />;
  return <PostForm channel={channel} initial={post} />;
}

/** 채널 없이 글쓰기로 들어오면 채널을 고르러 보낸다 */
function GoToChannels() {
  useEffect(() => toast('글은 채널 안에서 쓸 수 있어요. 채널을 먼저 골라 주세요'), []);
  return <Navigate to="/channels" replace />;
}

export default function WritePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const slug = params.get('channel');
  return (
    <Page variant="single">
      {id ? (
        <EditPost id={Number(id)} />
      ) : slug ? (
        <NewPost slug={slug} defaultCategory={Number(params.get('category')) || undefined} />
      ) : (
        <GoToChannels />
      )}
    </Page>
  );
}
