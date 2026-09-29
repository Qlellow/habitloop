import { useDeferredValue, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useChannel, useChannels, usePost, useSavePost, type PostDetail } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { toast } from '../components/Toast';
import ui from '../components/ui.module.css';
import s from './pages.module.css';

/** 글을 올릴 채널 고르기. 펼치면 검색할 수 있다. */
function ChannelPicker({ value, onChange }: { value?: string; onChange: (slug: string) => void }) {
  const [open, setOpen] = useState(!value);
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const { data: selected } = useChannel(value);
  const { data: channels } = useChannels(q);

  if (!open && value && !selected) return <div className={`${s.picked} ${ui.skeleton}`} style={{ height: 50 }} />;

  if (!open && selected) {
    return (
      <button type="button" className={s.picked} onClick={() => setOpen(true)}>
        <ChannelIcon slug={selected.slug} name={selected.name} size={30} />
        <span className={s.pickedName}>{selected.name}</span>
        <span className={s.pickedChange}>변경</span>
      </button>
    );
  }

  return (
    <div className={s.pickerPanel}>
      <input
        type="search"
        className={ui.input}
        placeholder="어느 채널에 올릴까요? 이름으로 찾기"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="채널 검색"
        autoFocus={!!value}
      />
      <ul className={s.pickerList}>
        {channels?.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              className={s.row}
              onClick={() => {
                onChange(c.slug);
                setOpen(false);
              }}
            >
              <ChannelIcon slug={c.slug} name={c.name} size={30} />
              <span className={s.rowBody}>
                <span className={s.rowName}>{c.name}</span> <span className={s.rowDesc}>c/{c.slug}</span>
              </span>
            </button>
          </li>
        ))}
        {channels?.length === 0 && <li className={ui.empty} style={{ padding: 20 }}>찾는 채널이 없어요</li>}
      </ul>
    </div>
  );
}

/** 채널 안 카테고리 고르기. 관리자 전용 카테고리는 채널 관리자에게만 보인다. */
function CategoryPicker({
  channel,
  value,
  onChange,
}: {
  channel: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data, isPlaceholderData } = useChannel(channel);
  if (!data || isPlaceholderData) return null;
  const selectable = data.categories.filter((c) => !c.ownerOnly || data.mine);
  if (selectable.length === 0) return null;
  return (
    <div className={ui.field}>
      <span className={ui.label}>카테고리</span>
      <div className={ui.chips} role="radiogroup" aria-label="카테고리">
        <button type="button" className={ui.chip} aria-pressed={value == null} onClick={() => onChange(null)}>
          선택 안 함
        </button>
        {selectable.map((c) => (
          <button type="button" key={c.id} className={ui.chip} aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function PostForm({
  initial,
  defaultChannel,
  defaultCategory,
}: {
  initial?: PostDetail;
  defaultChannel?: string;
  defaultCategory?: number;
}) {
  const navigate = useNavigate();
  const save = useSavePost(initial?.id);
  const [channel, setChannel] = useState(initial?.channel.slug ?? defaultChannel);
  const [categoryId, setCategoryId] = useState<number | null>(
    initial ? (initial.category?.id ?? null) : (defaultCategory ?? null),
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const valid = !!channel && title.trim().length > 0 && content.trim().length > 0;

  const pickChannel = (slug: string) => {
    setChannel(slug);
    setCategoryId(null); // 카테고리는 채널마다 다르다
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { channel, categoryId, title: title.trim(), content },
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
    <form className={`${ui.card} ${s.formCard}`} onSubmit={submit}>
      <div className={ui.field}>
        <span className={ui.label}>채널</span>
        {initial ? (
          <div className={s.picked}>
            <ChannelIcon slug={initial.channel.slug} name={initial.channel.name} size={30} />
            <span className={s.pickedName}>{initial.channel.name}</span>
          </div>
        ) : (
          <ChannelPicker value={channel} onChange={pickChannel} />
        )}
      </div>
      {channel && <CategoryPicker channel={channel} value={categoryId} onChange={setCategoryId} />}
      <label className={ui.field}>
        <span className={ui.label}>제목</span>
        <input
          className={ui.input}
          style={{ fontSize: 18, fontWeight: 600 }}
          placeholder="제목을 입력해 주세요"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!!initial || !!defaultChannel}
        />
      </label>
      <MarkdownEditor value={content} onChange={setContent} />
      <div className={s.formFoot}>
        <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => navigate(-1)}>
          취소
        </button>
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={!valid || save.isPending}>
          {save.isPending ? '저장 중…' : initial ? '수정하기' : '올리기'}
        </button>
      </div>
    </form>
  );
}

function EditPost({ id }: { id: number }) {
  const { data, isPending, isError } = usePost(id);
  if (isPending) return <div className={ui.spinner} />;
  if (isError || !data.mine) return <Navigate to={`/posts/${id}`} replace />;
  return <PostForm initial={data} />;
}

export default function WritePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editId = id ? Number(id) : undefined;
  return (
    <Page variant="single">
      <h1 className={s.pageTitle}>{editId ? '글 수정' : '글쓰기'}</h1>
      {editId ? (
        <EditPost id={editId} />
      ) : (
        <PostForm
          defaultChannel={params.get('channel') ?? undefined}
          defaultCategory={Number(params.get('category')) || undefined}
        />
      )}
    </Page>
  );
}
