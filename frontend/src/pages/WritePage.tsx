import { useDeferredValue, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useChannel, useChannels, usePost, useSavePost } from '../api/queries';
import type { PostDetail } from '../api/types';
import { ChannelIcon } from '../components/ChannelIcon';
import { SubHeader } from '../components/Layout';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { toast } from '../components/Toast';
import ch from '../components/Channel.module.css';
import ui from '../components/ui.module.css';
import s from './Write.module.css';

/** 글을 올릴 채널 고르기. 목록을 펼치면 검색할 수 있다. */
function ChannelPicker({ value, onChange }: { value?: string; onChange: (slug: string) => void }) {
  const [open, setOpen] = useState(!value);
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const { data: selected } = useChannel(value);
  const { data: channels } = useChannels(q);

  if (!open && value && !selected) {
    return <div className={`${s.picked} ${ui.skeleton}`} style={{ height: 64 }} />;
  }

  if (!open && selected) {
    return (
      <button type="button" className={s.picked} onClick={() => setOpen(true)}>
        <ChannelIcon slug={selected.slug} name={selected.name} />
        <span className={s.pickedName}>{selected.name}</span>
        <span className={s.change}>변경</span>
      </button>
    );
  }

  return (
    <div className={s.picker}>
      <input
        type="search"
        className={ui.input}
        placeholder="어느 채널에 올릴까요?"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="채널 검색"
      />
      <ul className={s.pickerList}>
        {channels?.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              className={ch.row}
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => {
                onChange(c.slug);
                setOpen(false);
              }}
            >
              <ChannelIcon slug={c.slug} name={c.name} />
              <div className={ch.rowBody}>
                <div className={ch.rowName}>{c.name}</div>
                <div className={ch.rowDesc}>c/{c.slug}</div>
              </div>
            </button>
          </li>
        ))}
        {channels?.length === 0 && <li className={ui.empty} style={{ padding: 24 }}>찾는 채널이 없어요</li>}
      </ul>
    </div>
  );
}

function PostForm({ initial, defaultChannel }: { initial?: PostDetail; defaultChannel?: string }) {
  const navigate = useNavigate();
  const save = useSavePost(initial?.id);
  const [channel, setChannel] = useState(initial?.channel.slug ?? defaultChannel);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const valid = !!channel && title.trim().length > 0 && content.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { channel, title: title.trim(), content },
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
    <form onSubmit={submit} className={s.form}>
      {initial ? (
        <div className={s.picked} style={{ cursor: 'default' }}>
          <ChannelIcon slug={initial.channel.slug} name={initial.channel.name} />
          <span className={s.pickedName}>{initial.channel.name}</span>
        </div>
      ) : (
        <ChannelPicker value={channel} onChange={setChannel} />
      )}
      <label className={ui.field}>
        <span className="sr-only">제목</span>
        <input
          className={ui.input}
          style={{ fontSize: 20, fontWeight: 600 }}
          placeholder="제목을 입력해 주세요"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!!initial || !!defaultChannel}
        />
      </label>
      <MarkdownEditor value={content} onChange={setContent} />
      <div className={ui.bottomCta}>
        <div>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.block}`} disabled={!valid || save.isPending}>
            {save.isPending ? '저장 중…' : initial ? '수정하기' : '올리기'}
          </button>
        </div>
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
    <div className={ui.sheet}>
      <SubHeader title={editId ? '글 수정' : '글쓰기'} />
      {editId ? <EditPost id={editId} /> : <PostForm defaultChannel={params.get('channel') ?? undefined} />}
    </div>
  );
}
