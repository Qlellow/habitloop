import { useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useCategoryMutation, useChannel, type ChannelCategory } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

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

  return (
    <li className={s.catRow}>
      <div className={s.catOrder}>
        <button type="button" aria-label={`${category.name} 위로`} disabled={index === 0 || editing} onClick={() => onMove(index, index - 1)}>
          ▲
        </button>
        <button
          type="button"
          aria-label={`${category.name} 아래로`}
          disabled={index === count - 1 || editing}
          onClick={() => onMove(index, index + 1)}
        >
          ▼
        </button>
      </div>
      {editing ? (
        <form className={s.catEdit} onSubmit={save}>
          <input
            className={cn(ui.input, s.input)}
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
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setEditing(false)}>
            취소
          </button>
          <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={!name.trim() || mutation.isPending}>
            저장
          </button>
        </form>
      ) : (
        <>
          <div className={s.catName}>
            {category.name}
            {category.ownerOnly && <span className={ui.badge}>관리자 전용</span>}
          </div>
          <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => setEditing(true)}>
            수정
          </button>
          <button type="button" className={cn(ui.button, ui.text, ui.small, ui.danger)} onClick={remove}>
            삭제
          </button>
        </>
      )}
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
    <form className={s.addRow} onSubmit={submit}>
      <input
        className={ui.input}
        placeholder={disabled ? `카테고리는 ${MAX}개까지 만들 수 있어요` : '새 카테고리 이름 (예: 공지사항)'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        disabled={disabled}
        aria-label="새 카테고리 이름"
      />
      <label className={s.toggle} title="공지사항처럼 채널 관리자만 글을 올릴 수 있어요">
        <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} disabled={disabled} />
        관리자만 글쓰기
      </label>
      <button type="submit" className={cn(ui.button, ui.primary)} disabled={disabled || !name.trim() || mutation.isPending}>
        추가
      </button>
    </form>
  );
}

export default function ChannelManagePage() {
  const { slug = '' } = useParams();
  const { data: channel, isPending, isPlaceholderData, isError } = useChannel(slug);
  const reorder = useCategoryMutation(slug);

  if (isPending || isPlaceholderData) {
    return (
      <Page variant="single">
        <div className={ui.spinner} />
      </Page>
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
    <Page variant="single">
      <div className={s.pageHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChannelIcon slug={channel.slug} name={channel.name} size={44} />
          <div>
            <h1 className={s.pageTitle}>{channel.name} 관리</h1>
            <Link to={`/c/${slug}`} className={ui.cardLink}>
              채널로 돌아가기 →
            </Link>
          </div>
        </div>
      </div>
      <section className={cn(ui.card, s.settingsSection)}>
        <div className={s.pageHead}>
          <div>
            <h2 className={s.settingsTitle}>채널 정보</h2>
            <p className={s.settingsDesc} style={{ marginBottom: 0 }}>
              {channel.description || '소개가 아직 없어요'}
            </p>
          </div>
          <Link to={`/c/${slug}/edit`} className={cn(ui.button, ui.ghost)} onPointerEnter={preload.channelForm}>
            수정
          </Link>
        </div>
      </section>
      <section className={cn(ui.card, s.settingsSection)}>
        <h2 className={s.settingsTitle}>
          카테고리 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-weak)' }}>{categories.length}/{MAX}</span>
        </h2>
        <p className={s.settingsDesc}>
          채널 글을 공지사항·소설·일러스트처럼 나눠 보세요. 여기 순서대로 채널 탭에 보여요. 카테고리를 지워도 글은 남아요.
        </p>
        {categories.length > 0 ? (
          <ul className={s.catTable}>
            {categories.map((c, i) => (
              <CategoryRow key={c.id} category={c} index={i} count={categories.length} onMove={move} slug={slug} />
            ))}
          </ul>
        ) : (
          <div className={ui.empty} style={{ padding: '12px 0 20px' }}>
            아직 카테고리가 없어요
          </div>
        )}
        <AddCategory slug={slug} disabled={categories.length >= MAX} />
      </section>
    </Page>
  );
}
