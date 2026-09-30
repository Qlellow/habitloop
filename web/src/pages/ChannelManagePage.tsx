import { useDeferredValue, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  plainText,
  useCategoryMutation,
  useChangeRole,
  useChannel,
  useMemberSearch,
  useStaff,
  type ChannelCategory,
  type StaffMember,
} from '@loop/shared';
import { RoleBadge, ROLE_LABEL } from '../components/RoleBadge';
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
            운영진만 글쓰기
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
            {category.ownerOnly && <span className={ui.badge}>운영진 전용</span>}
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
      <label className={s.toggle} title="공지사항처럼 채널 운영진(소유자·관리자·매니저)만 글을 올릴 수 있어요">
        <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} disabled={disabled} />
        운영진만 글쓰기
      </label>
      <button type="submit" className={cn(ui.button, ui.primary)} disabled={disabled || !name.trim() || mutation.isPending}>
        추가
      </button>
    </form>
  );
}

type Assignable = StaffMember['role'];
const ASSIGN: [Exclude<Assignable, 'OWNER'>, string][] = [
  ['ADMIN', '관리자'],
  ['MANAGER', '매니저'],
  ['MEMBER', '해제'],
];

/** 역할 고르기: 관리자 · 매니저 · 해제(일반 멤버) */
function RolePicker({ slug, member }: { slug: string; member: StaffMember }) {
  const change = useChangeRole(slug);
  return (
    <div className={s.roleSegment} role="group" aria-label={`${member.nickname} 역할`}>
      {ASSIGN.filter(([role]) => role !== 'MEMBER' || member.role !== 'MEMBER').map(([role, label]) => (
        <button
          key={role}
          type="button"
          className={s.segmentButton}
          aria-pressed={member.role === role}
          disabled={change.isPending}
          onClick={() => {
            if (member.role === role) return;
            change.mutate(
              { userId: member.userId, role },
              {
                onSuccess: () =>
                  toast(role === 'MEMBER' ? `${member.nickname}님을 운영진에서 해제했어요` : `${member.nickname}님을 ${label}로 지정했어요`),
                onError: (e) => toast(e.message),
              },
            );
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * 운영진: 관리자는 채널 관리(정보·프로필·카테고리)와 글·댓글 정리를, 매니저는 글·댓글 정리를 할 수 있다.
 * 지정과 해제는 소유자만 할 수 있고, 관리자에게는 목록만 보인다.
 */
function StaffSection({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const staff = useStaff(slug);
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const search = useMemberSearch(slug, isOwner ? q : '');

  return (
    <section className={cn(ui.card, s.settingsSection)}>
      <h2 className={s.settingsTitle}>운영진</h2>
      <p className={s.settingsDesc}>
        <b>관리자</b>는 채널 정보·프로필·카테고리를 관리하고, <b>매니저</b>는 글과 댓글을 정리할 수 있어요. 둘 다 운영진 전용 카테고리에
        글을 쓸 수 있어요.{isOwner ? '' : ' 운영진 지정은 채널 소유자만 할 수 있어요.'}
      </p>
      <ul className={s.staffList}>
        {staff.data?.map((m) => (
          <li key={m.userId} className={s.staffRow}>
            <span className={s.staffName}>
              {m.nickname}
              <RoleBadge role={m.role} />
            </span>
            {isOwner && m.role !== 'OWNER' ? (
              <RolePicker slug={slug} member={m} />
            ) : (
              <span className={s.staffRole}>{m.role === 'MEMBER' ? '멤버' : ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <div className={s.staffSearch}>
          <input
            className={ui.input}
            placeholder="운영진으로 지정할 멤버의 닉네임"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={20}
            aria-label="멤버 찾기"
          />
          {q.trim() && search.data && (
            <ul className={s.staffList}>
              {search.data.length === 0 ? (
                <li className={cn(ui.empty, 'py-4')}>'{q.trim()}' 닉네임의 멤버가 없어요 (채널을 팔로우한 사람만 지정할 수 있어요)</li>
              ) : (
                search.data.map((m) => (
                  <li key={m.userId} className={s.staffRow}>
                    <span className={s.staffName}>
                      {m.nickname}
                      <RoleBadge role={m.role} />
                    </span>
                    {m.role === 'OWNER' ? <span className={s.staffRole}>소유자</span> : <RolePicker slug={slug} member={m} />}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </section>
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
  if (isError || !channel.canManage) return <Navigate to={`/c/${slug}`} replace />;

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
          <ChannelIcon channel={channel} size={44} />
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
            <p className={cn(s.settingsDesc, 'line-clamp-2')} style={{ marginBottom: 0 }}>
              {plainText(channel.description) || '소개가 아직 없어요'}
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
      <StaffSection slug={slug} isOwner={channel.mine} />
    </Page>
  );
}
