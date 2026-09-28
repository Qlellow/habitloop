import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { usePost, useSavePost } from '../api/queries';
import type { Category, PostDetail } from '../api/types';
import { SubHeader } from '../components/Layout';
import { toast } from '../components/Toast';
import { CATEGORIES } from '../lib/categories';
import ui from '../components/ui.module.css';

function PostForm({ initial }: { initial?: PostDetail }) {
  const navigate = useNavigate();
  const save = useSavePost(initial?.id);
  const [category, setCategory] = useState<Category>(initial?.category ?? 'FREE');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const valid = title.trim().length > 0 && content.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { category, title: title.trim(), content },
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
    <form onSubmit={submit} style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: '4px 20px 120px' }}>
      <div className={ui.chips} style={{ padding: '4px 0 20px' }} role="radiogroup" aria-label="카테고리">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.value}
            className={ui.chip}
            aria-pressed={category === c.value}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className={ui.field}>
        <span className="sr-only">제목</span>
        <input
          className={ui.input}
          style={{ fontSize: 20, fontWeight: 600 }}
          placeholder="제목을 입력해 주세요"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!initial}
        />
      </label>
      <label className={ui.field}>
        <span className="sr-only">내용</span>
        <textarea
          className={ui.textarea}
          placeholder="자유롭게 이야기를 나눠 보세요"
          maxLength={20000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <div className={ui.bottomCta}>
        <div>
          <button
            type="submit"
            className={`${ui.button} ${ui.primary} ${ui.block}`}
            disabled={!valid || save.isPending}
          >
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
  const editId = id ? Number(id) : undefined;
  return (
    <div className={ui.sheet}>
      <SubHeader title={editId ? '글 수정' : '글쓰기'} />
      {editId ? <EditPost id={editId} /> : <PostForm />}
    </div>
  );
}
