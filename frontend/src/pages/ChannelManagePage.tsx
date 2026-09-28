import { useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useCategoryMutation, useChannel } from '../api/queries';
import type { ChannelCategory } from '../api/types';
import { Main, SubHeader } from '../components/Layout';
import { toast } from '../components/Toast';
import { preload } from '../lib/preload';
import ch from '../components/Channel.module.css';
import ui from '../components/ui.module.css';
import s from './ChannelManage.module.css';

const MAX = 20;

function CategoryRow({
  category,
  index,
  count,
  onMove,
  slug,
}: {
  category: ChannelCategory;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  slug: string;
}) {
  const mutation = useCategoryMutation(slug);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [ownerOnly, setOwnerOnly] = useState(category.ownerOnly);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(
      { type: 'update', id: category.id, name: name.trim(), ownerOnly },
      { onSuccess: () => setEditing(false), onError: (err) => toast(err.message) },
    );
  };

  const remove = () => {
    if (!confirm(`'${category.name}' 카테고리를 삭제할까요?\n이 카테고리의 글은 지워지지 않고 '카테고리 없음'이 돼요.`)) return;
    mutation.mutate({ type: 'delete', id: category.id }, { onError: (err) => toast(err.message) });
  };

  if (editing) {
    return (
      <li className={s.row}>
        <form className={s.editForm} onSubmit={save}>
          <input
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            aria-label="카테고리 이름"
            autoFocus
          />
          <label className={s.toggle}>
            <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} />
            관리자만 글쓰기
          </label>
          <div className={s.editActions}>
            <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setEditing(false)}>
              취소
            </button>
            <button type="submit" className={`${ui.button} ${ui.primary} ${ui.small}`} disabled={!name.trim() || mutation.isPending}>
              저장
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={s.row}>
      <div className={s.order}>
        <button type="button" aria-label={`${category.name} 위로`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
          ▲
        </button>
        <button
          type="button"
          aria-label={`${category.name} 아래로`}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          ▼
        </button>
      </div>
      <div className={s.name}>
        {category.name}
        {category.ownerOnly && <span className={s.tag}>관리자 전용</span>}
      </div>
      <button type="button" className={s.action} onClick={() => setEditing(true)}>
        수정
      </button>
      <button type="button" className={`${s.action} ${s.danger}`} onClick={remove}>
        삭제
      </button>
    </li>
  );
}

function AddCategory({ slug, disabled }: { slug: string; disabled: boolean }) {
  const mutation = useCategoryMutation(slug);
  const [name, setName] = useState('');
  const [ownerOnly, setOwnerOnly] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(
      { type: 'create', name: name.trim(), ownerOnly },
      {
        onSuccess: () => {
          setName('');
          setOwnerOnly(false);
        },
        onError: (err) => toast(err.message),
      },
    );
  };

  return (
    <form className={s.add} onSubmit={submit}>
      <div className={s.addRow}>
        <input
          className={ui.input}
          placeholder={disabled ? `카테고리는 ${MAX}개까지 만들 수 있어요` : '새 카테고리 이름 (예: 공지사항)'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          disabled={disabled}
          aria-label="새 카테고리 이름"
        />
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={disabled || !name.trim() || mutation.isPending}>
          추가
        </button>
      </div>
      <label className={s.toggle}>
        <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} disabled={disabled} />
        관리자만 글쓰기 <span className={s.hint}>공지사항처럼 나만 글을 올릴 수 있어요</span>
      </label>
    </form>
  );
}

export default function ChannelManagePage() {
  const { slug = '' } = useParams();
  const { data: channel, isPending, isPlaceholderData, isError } = useChannel(slug);
  const reorder = useCategoryMutation(slug);

  if (isPending || isPlaceholderData) {
    return (
      <>
        <SubHeader title="채널 관리" />
        <div className={ui.spinner} />
      </>
    );
  }
  if (isError || !channel.mine) return <Navigate to={`/c/${slug}`} replace />;

  const categories = channel.categories;
  const move = (from: number, to: number) => {
    const ids = categories.map((c) => c.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate({ type: 'reorder', ids }, { onError: (err) => toast(err.message) });
  };

  return (
    <>
      <SubHeader title="채널 관리" backTo={`/c/${slug}`} />
      <Main>
        <section className={ui.card} style={{ marginBottom: 12 }}>
          <Link to={`/c/${slug}/edit`} className={ch.row} onPointerEnter={preload.channelForm}>
            <div className={ch.rowBody}>
              <div className={ch.rowName}>채널 정보 수정</div>
              <div className={ch.rowDesc}>
                {channel.name} · {channel.description || '소개 없음'}
              </div>
            </div>
            <span className={ch.rowCount}>›</span>
          </Link>
        </section>
        <section className={ui.card}>
          <h2 className={ui.sectionTitle}>
            카테고리 <span className={s.count}>{categories.length}/{MAX}</span>
          </h2>
          <p className={s.desc}>채널 글을 공지사항·소설·일러스트처럼 나눠 보세요. 순서는 채널 탭에 그대로 보여요.</p>
          {categories.length > 0 ? (
            <ul className={s.list}>
              {categories.map((c, i) => (
                <CategoryRow key={c.id} category={c} index={i} count={categories.length} onMove={move} slug={slug} />
              ))}
            </ul>
          ) : (
            <div className={ui.empty} style={{ padding: '20px 20px 8px' }}>
              아직 카테고리가 없어요
            </div>
          )}
          <AddCategory slug={slug} disabled={categories.length >= MAX} />
        </section>
      </Main>
    </>
  );
}
