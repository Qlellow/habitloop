import { useDeferredValue, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  plainText,
  useAuth,
  useCategoryMutation,
  useCategoryPostCounts,
  useRegenerateInvite,
  type ChannelDetail,
  useChangeRole,
  useChannel,
  useMemberSearch,
  useStaff,
  type ChannelCategory,
  type StaffMember,
} from '@loop/shared';
import { RoleBadge, ROLE_LABEL } from '../components/RoleBadge';
import { ChannelIcon } from '../components/ChannelIcon';
import { Dropdown } from '../components/Dropdown';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { preload } from '../lib/preload';
import { moveItem, useSortable } from '../lib/sortable';
import { ui } from '../components/ui';
import s from './pages.styles';
import { Modal } from '../components/Modal';
import { cn } from '../lib/cn';

const MAX = 20;
const ADULT_HINT = '설정에서 나이를 확인한 만 19세 이상만 이 카테고리를 보고 쓸 수 있어요';
const ADULT_LOCKED = '만 19세 이상 카테고리는 설정에서 나이를 확인한 만 19세 이상만 만들 수 있어요';

function CategoryRow({
  category,
  index,
  onMove,
  onDelete,
  slug,
  handle,
  style,
}: {
  category: ChannelCategory;
  index: number;
  onMove: (from: number, to: number) => void;
  onDelete: (category: ChannelCategory) => void;
  slug: string;
  /** 끌어서 순서 바꾸기 손잡이 */
  handle: ReturnType<ReturnType<typeof useSortable>['handleProps']>;
  style?: CSSProperties;
}) {
  const mutation = useCategoryMutation(slug);
  const canAdult = !!useAuth().user?.adult;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [ownerOnly, setOwnerOnly] = useState(category.ownerOnly);
  const [adult, setAdult] = useState(!!category.adult);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(
      { type: 'update', id: category.id, name: name.trim(), ownerOnly, adult },
      { onSuccess: () => setEditing(false), onError: (err) => toast(err.message) },
    );
  };

  return (
    <li className={s.catRow} style={style}>
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
          <label className={s.toggle} title={canAdult || category.adult ? ADULT_HINT : ADULT_LOCKED}>
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} disabled={!canAdult && !category.adult} />
            만 19세 이상
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
            {category.ownerOnly && <span className={ui.badge}>운영진 전용 · 공지</span>}
            {category.adult && (
              <span className="text-[17px] leading-none" role="img" aria-label="만 19세 이상" title="만 19세 이상">
                🔞
              </span>
            )}
          </div>
          <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => setEditing(true)}>
            수정
          </button>
          <button type="button" className={cn(ui.button, ui.text, ui.small, ui.danger)} onClick={() => onDelete(category)}>
            삭제
          </button>
        </>
      )}
      {/* 오른쪽 손잡이를 잡고 끌어서 순서를 바꾼다. 키보드로는 손잡이에서 ↑/↓ */}
      <span
        {...handle}
        role="button"
        tabIndex={0}
        aria-label={`${category.name} 순서 바꾸기 (위·아래 화살표)`}
        title="끌어서 순서 바꾸기"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          onMove(index, e.key === 'ArrowUp' ? index - 1 : index + 1);
        }}
        className="flex-none grid place-items-center w-7 h-9 rounded-sm text-fg-weak select-none hover:bg-field hover:text-fg-sub focus-visible:outline-2 focus-visible:outline-primary"
      >
        ⠿
      </span>
    </li>
  );
}

/**
 * 카테고리 삭제 창. 카테고리가 있는 채널의 글은 카테고리가 꼭 있어야 하므로, 글이 있으면 옮길 카테고리를 고른다.
 * (마지막 카테고리를 지우면 채널에 카테고리가 없어지므로 글은 그대로 남는다)
 */
function DeleteCategoryDialog({
  slug,
  category,
  categories,
  onClose,
}: {
  slug: string;
  category: ChannelCategory;
  categories: ChannelCategory[];
  onClose: () => void;
}) {
  const mutation = useCategoryMutation(slug);
  const counts = useCategoryPostCounts(slug);
  const others = categories.filter((c) => c.id !== category.id);
  // 기본으로는 같은 무리(운영진 전용/일반)의 첫 카테고리, 없으면 아무 첫 카테고리
  const [moveTo, setMoveTo] = useState<number | undefined>(() => (others.find((c) => c.ownerOnly === category.ownerOnly) ?? others[0])?.id);
  const postCount = counts.data?.[category.id] ?? 0;
  const needsMove = postCount > 0 && others.length > 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const remove = () =>
    mutation.mutate(
      { type: 'delete', id: category.id, moveTo: needsMove ? moveTo : undefined },
      {
        onSuccess: () => {
          const target = others.find((c) => c.id === moveTo);
          toast(needsMove && target ? `'${category.name}' 을 지우고 글 ${postCount}개를 '${target.name}' 로 옮겼어요` : `'${category.name}' 카테고리를 지웠어요`);
          onClose();
        },
        onError: (err) => toast(err.message),
      },
    );

  return (
    <Modal onClose={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-cat-title" className="w-full max-w-[400px] p-6 rounded-xl border border-border bg-surface shadow-pop">
        <h2 id="delete-cat-title" className="m-0 text-lg font-bold text-fg-strong">
          '{category.name}' 카테고리를 삭제할까요?
        </h2>
        {counts.isPending ? (
          <div className={cn(ui.spinner, 'my-4')} />
        ) : needsMove ? (
          <>
            <p className="mt-2 mb-4 text-[15px] text-fg-sub">
              이 카테고리의 글 <b className="text-fg-strong">{postCount.toLocaleString()}개</b>는 지워지지 않고, 아래에서 고른 카테고리로 옮겨져요.
            </p>
            <Dropdown
              label="글을 옮길 카테고리"
              value={moveTo}
              onChange={setMoveTo}
              options={others.map((c) => ({ value: c.id, label: c.name, hint: c.ownerOnly ? '운영진 전용' : undefined }))}
              className="w-full"
            />
          </>
        ) : (
          <p className="mt-2 mb-0 text-[15px] text-fg-sub">
            {postCount > 0
              ? `마지막 카테고리라, 글 ${postCount.toLocaleString()}개는 지워지지 않고 카테고리 없이 남아요.`
              : '이 카테고리에는 글이 없어요.'}
          </p>
        )}
        <div className="flex gap-2 mt-6">
          <button type="button" className={cn(ui.button, ui.ghost, 'flex-1')} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={cn(ui.button, 'bg-danger text-white hover:brightness-95', 'flex-1')}
            disabled={counts.isPending || mutation.isPending || (needsMove && moveTo == null)}
            onClick={remove}
          >
            {needsMove ? '옮기고 삭제' : '삭제'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddCategory({ slug, disabled }: { slug: string; disabled: boolean }) {
  const mutation = useCategoryMutation(slug);
  const canAdult = !!useAuth().user?.adult;
  const [name, setName] = useState('');
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [adult, setAdult] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(
      { type: 'create', name: name.trim(), ownerOnly, adult },
      {
        onSuccess: () => {
          setName('');
          setOwnerOnly(false);
          setAdult(false);
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
      <label className={s.toggle} title={canAdult ? ADULT_HINT : ADULT_LOCKED}>
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} disabled={disabled || !canAdult} />
        만 19세 이상
      </label>
      <button type="submit" className={cn(ui.button, ui.primary)} disabled={disabled || !name.trim() || mutation.isPending}>
        추가
      </button>
    </form>
  );
}

/**
 * 초대: 비공개 채널은 초대 링크 · 코드 · QR 로만 팔로우할 수 있다. 코드를 새로 만들면 예전 것은 막힌다.
 */
function InviteSection({ channel }: { channel: ChannelDetail }) {
  const regenerate = useRegenerateInvite(channel.slug);
  const [qr, setQr] = useState<string>();
  const code = channel.inviteCode ?? '';
  const link = `${location.origin}/invite/${code}`;

  // QR 은 이 화면에서만 쓰므로 라이브러리를 그때 받는다
  useEffect(() => {
    if (!code) return;
    let alive = true;
    void import('qrcode').then((QR) =>
      QR.toDataURL(link, { width: 360, margin: 1, color: { dark: '#191f28', light: '#ffffff' } }).then((url) => alive && setQr(url)),
    );
    return () => {
      alive = false;
    };
  }, [code, link]);

  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast(`${what}를 복사했어요`),
      () => toast('복사하지 못했어요. 직접 선택해서 복사해 주세요'),
    );

  return (
    <section className={cn(ui.card, s.settingsSection)}>
      <h2 className={s.settingsTitle}>초대 {channel.visibility === 'private' ? <span className={cn(ui.badge, 'ml-1 align-[2px]')}>🔒 비공개 채널</span> : null}</h2>
      <p className={s.settingsDesc}>
        {channel.visibility === 'private'
          ? '비공개 채널은 이 링크 · 코드 · QR 로만 팔로우할 수 있어요. 새로 만들면 예전 링크와 코드는 더 이상 쓸 수 없어요.'
          : '공개 채널은 누구나 팔로우할 수 있지만, 링크나 QR 로 초대할 수도 있어요. 비공개로 바꾸려면 채널 정보 수정에서 공개 설정을 바꿔 주세요.'}
      </p>
      {code ? (
        <div className="flex flex-wrap items-start gap-5">
          {qr ? (
            <a href={qr} download={`loop-${channel.slug}-invite.png`} title="QR 코드 이미지로 저장" className="flex-none">
              <img src={qr} alt="초대 QR 코드" width={144} height={144} className="block w-36 h-36 rounded-md border border-border bg-white p-1" />
            </a>
          ) : (
            <span className={cn(ui.skeleton, 'block w-36 h-36')} />
          )}
          <div className="flex-1 min-w-[220px] flex flex-col gap-3">
            <div>
              <div className="text-[13px] font-semibold text-fg-sub">초대 코드</div>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-3 py-1.5 rounded-md bg-field text-lg font-bold tracking-[0.25em] text-fg-strong">{code}</code>
                <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => copy(code, '초대 코드')}>
                  복사
                </button>
              </div>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-fg-sub">초대 링크</div>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span className="min-w-0 truncate text-sm text-fg">{link}</span>
                <button type="button" className={cn(ui.button, ui.ghost, ui.small, 'flex-none')} onClick={() => copy(link, '초대 링크')}>
                  복사
                </button>
              </div>
            </div>
            <div>
              <button
                type="button"
                className={cn(ui.button, ui.text, ui.small, ui.danger, '-ml-2.5')}
                disabled={regenerate.isPending}
                onClick={() =>
                  confirm('초대 코드를 새로 만들까요?\n예전 링크 · 코드 · QR 로는 더 이상 팔로우할 수 없어요.') &&
                  regenerate.mutate(undefined, { onSuccess: () => toast('새 초대 코드를 만들었어요'), onError: (e) => toast(e.message) })
                }
              >
                새 코드 만들기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className={ui.help}>초대 코드가 아직 없어요. 채널 정보를 한 번 저장하면 만들어져요.</p>
      )}
    </section>
  );
}

type Assignable = StaffMember['role'];
const ASSIGN: [Exclude<Assignable, 'OWNER'>, string][] = [
  ['ADMIN', '관리자'],
  ['MANAGER', '매니저'],
  ['MEMBER', '제외'],
];

/** 역할 고르기: 관리자 · 매니저 · 제외(일반 멤버로) */
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
                  toast(role === 'MEMBER' ? `${member.nickname}님을 운영진에서 제외했어요` : `${member.nickname}님을 ${label}로 지정했어요`),
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
 * 지정과 제외는 소유자만 할 수 있고, 관리자에게는 목록만 보인다.
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
                    {/* 이미 운영진이면 위 운영진 목록에서 바꾼다 */}
                    {m.role === 'MEMBER' ? <RolePicker slug={slug} member={m} /> : <span className={s.staffRole}>이미 {ROLE_LABEL[m.role]}</span>}
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
  const [pendingOrder, setPendingOrder] = useState<number[]>();
  const [deleting, setDeleting] = useState<ChannelCategory>();
  const sortable = useSortable((from, to) => move(from, to));

  if (isPending || isPlaceholderData) {
    return (
      <Page variant="single">
        <div className={ui.spinner} />
      </Page>
    );
  }
  if (isError || !channel.canManage) return <Navigate to={`/c/${slug}`} replace />;

  // 놓자마자 새 순서로 보여 주고(서버 응답을 기다리면 한 번 튄다), 저장이 끝나면 서버 순서를 쓴다
  const categories = pendingOrder
    ? pendingOrder.map((id) => channel.categories.find((c) => c.id === id)).filter((c): c is ChannelCategory => !!c)
    : channel.categories;
  // 운영진 전용 카테고리는 항상 일반 카테고리보다 위: 각자 자기 무리 안에서만 움직인다
  const staffCount = categories.filter((c) => c.ownerOnly).length;
  const move = (from: number, rawTo: number) => {
    const [min, max] = categories[from]?.ownerOnly ? [0, staffCount - 1] : [staffCount, categories.length - 1];
    const to = Math.max(min, Math.min(max, rawTo));
    if (to !== rawTo && rawTo >= 0 && rawTo < categories.length) toast('운영진 전용 카테고리는 항상 일반 카테고리보다 위에 있어요');
    if (to === from) return;
    const ids = moveItem(
      categories.map((c) => c.id),
      from,
      to,
    );
    setPendingOrder(ids);
    reorder.mutate({ type: 'reorder', ids }, { onError: (err) => toast(err.message), onSettled: () => setPendingOrder(undefined) });
  };

  return (
    <Page variant="single">
      {/* 채널 이름은 왼쪽, 돌아가기는 오른쪽 끝 (space-between) */}
      <div className={cn(s.pageHead, 'items-center')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <ChannelIcon channel={channel} size={44} />
          <h1 className={s.pageTitle}>{channel.name} 관리</h1>
        </div>
        <Link to={`/c/${slug}`} className={ui.cardLink}>
          채널로 돌아가기 →
        </Link>
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
      <InviteSection channel={channel} />
      <section className={cn(ui.card, s.settingsSection)}>
        <h2 className={s.settingsTitle}>
          카테고리 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-weak)' }}>{categories.length}/{MAX}</span>
        </h2>
        <p className={s.settingsDesc}>
          채널 글을 공지사항·소설·일러스트처럼 나눠 보세요. 오른쪽 ⠿ 를 끌어서 순서를 바꾸면 그 순서대로 채널 탭에 보여요. '운영진만 글쓰기' 카테고리는 항상 일반 카테고리보다 위에 있고, 그 글은 공지로 전체 탭 위에 고정돼요. 카테고리를 지울 때 글은 다른 카테고리로 옮겨져요.
        </p>
        {categories.length > 0 ? (
          <ul className={s.catTable} ref={sortable.listRef}>
            {categories.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                index={i}
                onMove={move}
                onDelete={setDeleting}
                slug={slug}
                handle={sortable.handleProps(i)}
                style={sortable.itemStyle(i)}
              />
            ))}
          </ul>
        ) : (
          <div className={ui.empty} style={{ padding: '12px 0 20px' }}>
            아직 카테고리가 없어요
          </div>
        )}
        <AddCategory slug={slug} disabled={categories.length >= MAX} />
        {deleting && <DeleteCategoryDialog slug={slug} category={deleting} categories={categories} onClose={() => setDeleting(undefined)} />}
      </section>
      <StaffSection slug={slug} isOwner={channel.mine} />
    </Page>
  );
}
