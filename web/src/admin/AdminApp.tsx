import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, CODE_LENGTH, REPORT_REASONS, timeAgo, type NoticeDetail, type NoticeInput, type NoticeKind, type NoticePage, type NoticeSummary } from '@loop/shared';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { noticeDate, NOTICE_KIND, NOTICE_KINDS } from '../lib/notices';
import { LogoMark } from '../components/Layout';
import { Toaster, toast } from '../components/Toast';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import { adminApi, adminToken } from './adminApi';

/* ───────── 타입 ───────── */

interface Stats {
  users: number;
  usersToday: number;
  suspended: number;
  channels: number;
  posts: number;
  postsToday: number;
  comments: number;
  commentsToday: number;
  openReports: number;
}
interface AdminReport {
  postId: number;
  commentId?: number;
  postTitle: string;
  excerpt: string;
  channel: { slug: string; name: string };
  author: { id: string; nickname: string };
  count: number;
  reasons: string[];
  details: string[];
  status: string;
  hidden: boolean;
  lastReportedAt: string;
}
interface AdminUserRow {
  id: string;
  nickname: string;
  email?: string;
  createdAt: string;
  points: number;
  postCount: number;
  commentCount: number;
  suspended: boolean;
  withdrawn: boolean;
  admin: boolean;
}
interface AdminChannel {
  slug: string;
  name: string;
  visibility: string;
  adult: boolean;
  memberCount: number;
  postCount: number;
  openReports: number;
  ownerNickname?: string;
  createdAt: string;
}
interface AdminLog {
  id: number;
  action: string;
  target?: string;
  detail?: string;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  login: '관리자 로그인',
  'user.suspend': '이용 정지',
  'user.unsuspend': '정지 해제',
  'report.hide': '신고 · 숨김',
  'report.unhide': '신고 · 숨김 풀기',
  'report.delete': '신고 · 삭제',
  'report.dismiss': '신고 · 문제 없음',
  'notice.create': '공지 올림',
  'notice.update': '공지 고침',
  'notice.delete': '공지 지움',
};
const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
const dateTime = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/* ───────── 로그인 ───────── */

function AdminLogin({ adminKey, onDone }: { adminKey: string; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      if (step === 'password') {
        await adminApi(adminKey, '/login/code', { method: 'POST', body: { email, password } });
        setStep('code');
      } else {
        const res = await adminApi<{ token: string }>(adminKey, '/login', { method: 'POST', body: { email, password, code } });
        adminToken.set(res.token);
        setPassword('');
        onDone();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid place-items-center min-h-dvh px-4 bg-bg">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-xl border border-border bg-surface p-7 shadow-pop">
        <div className="flex items-center gap-2 text-lg font-extrabold text-fg-strong">
          <LogoMark className="w-7 h-7" />
          루프 관리자
        </div>
        <p className="mt-2 mb-5 text-sm text-fg-sub">
          {step === 'password' ? '관리자 이메일과 비밀번호를 입력해 주세요.' : '관리자 이메일로 보낸 인증번호를 입력해 주세요.'}
        </p>
        {step === 'password' ? (
          <>
            <input className={ui.input} type="email" autoComplete="username" placeholder="이메일" aria-label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className={cn(ui.input, 'mt-3')}
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              aria-label="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <input
            className={cn(ui.input, 'tracking-[0.3em] text-center font-bold')}
            autoComplete="one-time-code"
            placeholder="인증번호"
            aria-label="인증번호"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
            required
          />
        )}
        {error && <p className={cn(ui.error, 'mt-3 mb-0')}>{error}</p>}
        <button type="submit" className={cn(ui.button, ui.primary, ui.full, 'mt-5')} disabled={pending}>
          {pending ? '확인하는 중…' : step === 'password' ? '인증번호 받기' : '로그인'}
        </button>
        {step === 'code' && (
          <button type="button" className={cn(ui.button, ui.text, ui.full, ui.small, 'mt-2')} onClick={() => (setStep('password'), setCode(''))}>
            처음부터 다시
          </button>
        )}
      </form>
    </main>
  );
}

/* ───────── 화면 조각 ───────── */

function useAdminQuery<T>(adminKey: string, path: string, query?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['admin', path, query],
    queryFn: () => adminApi<T>(adminKey, path, { query }),
    retry: false,
  });
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="text-[13px] font-semibold text-fg-sub">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold text-fg-strong tabular-nums">{value.toLocaleString()}</div>
      {sub && <div className="text-[13px] text-fg-weak">{sub}</div>}
    </div>
  );
}

function Overview({ adminKey, goReports }: { adminKey: string; goReports: () => void }) {
  const stats = useAdminQuery<Stats>(adminKey, '/stats');
  if (!stats.data) return <div className={ui.spinner} />;
  const s = stats.data;
  return (
    <div className="grid grid-cols-3 gap-3 max-[860px]:grid-cols-2 max-[520px]:grid-cols-1">
      <Stat label="회원" value={s.users} sub={`오늘 +${s.usersToday.toLocaleString()} · 정지 ${s.suspended.toLocaleString()}`} />
      <Stat label="채널" value={s.channels} />
      <Stat label="글" value={s.posts} sub={`오늘 +${s.postsToday.toLocaleString()}`} />
      <Stat label="댓글" value={s.comments} sub={`오늘 +${s.commentsToday.toLocaleString()}`} />
      <button type="button" onClick={goReports} className="text-left rounded-lg border border-border bg-surface px-5 py-4 transition-colors hover:bg-field">
        <div className="text-[13px] font-semibold text-fg-sub">처리 전 신고</div>
        <div className={cn('mt-1 text-[26px] font-extrabold tabular-nums', s.openReports ? 'text-danger-text' : 'text-fg-strong')}>{s.openReports.toLocaleString()}</div>
        <div className="text-[13px] text-fg-weak">모든 채널 · 눌러서 보기</div>
      </button>
    </div>
  );
}

function Reports({ adminKey }: { adminKey: string }) {
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const list = useAdminQuery<AdminReport[]>(adminKey, '/reports', { status });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const act = async (r: AdminReport, action: 'hide' | 'unhide' | 'delete' | 'dismiss') => {
    if (action === 'delete' && !confirm('지우면 되돌릴 수 없어요. 지울까요?')) return;
    setBusy(true);
    try {
      await adminApi(adminKey, '/reports/action', { method: 'POST', body: { postId: r.postId, commentId: r.commentId, action } });
      toast({ hide: '숨겼어요', unhide: '다시 보이게 했어요', delete: '지웠어요', dismiss: '문제 없음으로 처리했어요' }[action]);
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={cn(ui.card, 'px-5 pt-2 pb-1')}>
      <div className={ui.tabs} role="tablist">
        <button type="button" role="tab" className={ui.tab} aria-selected={status === 'open'} onClick={() => setStatus('open')}>
          처리 전
        </button>
        <button type="button" role="tab" className={ui.tab} aria-selected={status === 'done'} onClick={() => setStatus('done')}>
          처리함
        </button>
      </div>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : list.data.length === 0 ? (
        <p className={ui.empty}>{status === 'open' ? '처리할 신고가 없어요' : '처리한 신고가 없어요'}</p>
      ) : (
        <ul className="list-none m-0 p-0">
          {list.data.map((r) => (
            <li key={`${r.postId}-${r.commentId ?? ''}`} className="py-4 border-b border-line last:border-b-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className={cn(ui.badge, !!r.commentId && 'bg-field text-fg-sub')}>{r.commentId ? '댓글' : '글'}</span>
                <a href={`/c/${r.channel.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-fg-sub hover:underline">
                  {r.channel.name}
                </a>
                {status === 'open' ? (
                  <span className="font-bold text-danger-text">신고 {r.count}건</span>
                ) : (
                  <span className={cn(ui.badge, r.status === 'hidden' ? 'bg-danger-weak text-danger-text' : 'bg-field text-fg-sub')}>
                    {r.status === 'hidden' ? '숨김' : '문제 없음'}
                  </span>
                )}
                <span className="text-fg-weak">· {timeAgo(r.lastReportedAt)}</span>
              </div>
              <a href={`/posts/${r.postId}`} target="_blank" rel="noreferrer" className="block mt-1.5 group">
                <span className="block text-[15px] font-semibold text-fg-strong group-hover:underline">{r.postTitle}</span>
                {r.excerpt && <span className="block mt-0.5 text-sm text-fg-sub line-clamp-2">{r.excerpt}</span>}
              </a>
              <div className="mt-1 text-[13px] text-fg-weak">쓴 사람 {r.author.nickname}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.reasons.map((x) => (
                  <span key={x} className="px-2 py-0.5 rounded-full bg-field text-xs font-semibold text-fg-sub">
                    {reasonLabel(x)}
                  </span>
                ))}
              </div>
              {r.details.map((d, i) => (
                <p key={i} className="mt-2 mb-0 px-3 py-2 rounded-sm bg-field text-[13px] text-fg-sub whitespace-pre-wrap break-words">
                  {d}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                {status === 'open' ? (
                  <>
                    <button type="button" className={cn(ui.button, ui.secondary, ui.small)} disabled={busy} onClick={() => act(r, 'hide')}>
                      숨기기
                    </button>
                    <button type="button" className={cn(ui.button, ui.small, 'bg-danger text-white hover:brightness-95')} disabled={busy} onClick={() => act(r, 'delete')}>
                      지우기
                    </button>
                    <button type="button" className={cn(ui.button, ui.ghost, ui.small)} disabled={busy} onClick={() => act(r, 'dismiss')}>
                      문제 없음
                    </button>
                  </>
                ) : (
                  r.hidden && (
                    <button type="button" className={cn(ui.button, ui.ghost, ui.small)} disabled={busy} onClick={() => act(r, 'unhide')}>
                      숨김 풀기
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Users({ adminKey }: { adminKey: string }) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<number>();
  const list = useAdminQuery<{ items: AdminUserRow[]; nextCursor?: number }>(adminKey, '/users', { q, cursor });
  const qc = useQueryClient();
  const toggle = async (u: AdminUserRow) => {
    const suspend = !u.suspended;
    if (suspend && !confirm(`${u.nickname}님의 이용을 정지할까요?\n모든 기기에서 로그아웃되고 다시 로그인할 수 없어요.`)) return;
    try {
      await adminApi(adminKey, `/users/${u.id}/suspend`, { method: 'POST', body: { suspend } });
      toast(suspend ? '이용을 정지했어요' : '정지를 풀었어요');
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <section className={cn(ui.card, 'p-5')}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCursor(undefined);
          setQ(input.trim());
        }}
      >
        <input className={cn(ui.input, 'flex-1')} type="search" placeholder="닉네임 또는 이메일" aria-label="사용자 검색" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" className={cn(ui.button, ui.primary)}>
          검색
        </button>
      </form>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : list.data.items.length === 0 ? (
        <p className={ui.empty}>사용자가 없어요</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-fg-weak border-b border-border [&>th]:py-2 [&>th]:pr-3 [&>th]:font-semibold [&>th]:whitespace-nowrap">
                <th>닉네임</th>
                <th>이메일</th>
                <th className="text-right">글 · 댓글</th>
                <th className="text-right">포인트</th>
                <th>가입</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-b-0 [&>td]:py-2.5 [&>td]:pr-3">
                  <td className="font-semibold text-fg-strong whitespace-nowrap">
                    <a href={`/u/${u.id}`} target="_blank" rel="noreferrer" className="hover:underline">
                      {u.nickname}
                    </a>
                    {u.admin && <span className={cn(ui.badge, 'ml-1.5')}>관리자 이메일</span>}
                    {u.suspended && <span className={cn(ui.badge, 'ml-1.5 bg-danger-weak text-danger-text')}>정지</span>}
                    {u.withdrawn && <span className={cn(ui.badge, 'ml-1.5 bg-field text-fg-sub')}>탈퇴</span>}
                  </td>
                  <td className="text-fg-sub">{u.email ?? '-'}</td>
                  <td className="text-right tabular-nums text-fg-sub whitespace-nowrap">
                    {u.postCount.toLocaleString()} · {u.commentCount.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums text-fg-sub">{u.points.toLocaleString()}</td>
                  <td className="text-fg-weak whitespace-nowrap">{dateTime(u.createdAt)}</td>
                  <td className="text-right">
                    {!u.admin && !u.withdrawn && (
                      <button type="button" className={cn(ui.button, ui.small, u.suspended ? ui.secondary : cn(ui.ghost, 'text-danger-text'))} onClick={() => toggle(u)}>
                        {u.suspended ? '정지 해제' : '이용 정지'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-3">
        {cursor !== undefined && (
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setCursor(undefined)}>
            처음으로
          </button>
        )}
        {list.data?.nextCursor !== undefined && (
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setCursor(list.data!.nextCursor)}>
            다음 30명 →
          </button>
        )}
      </div>
    </section>
  );
}

function Channels({ adminKey }: { adminKey: string }) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const list = useAdminQuery<AdminChannel[]>(adminKey, '/channels', { q });
  return (
    <section className={cn(ui.card, 'p-5')}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(input.trim());
        }}
      >
        <input className={cn(ui.input, 'flex-1')} type="search" placeholder="채널 이름 또는 고리" aria-label="채널 검색" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" className={cn(ui.button, ui.primary)}>
          검색
        </button>
      </form>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-fg-weak border-b border-border [&>th]:py-2 [&>th]:pr-3 [&>th]:font-semibold [&>th]:whitespace-nowrap">
                <th>채널</th>
                <th>주인</th>
                <th className="text-right">팔로워</th>
                <th className="text-right">글</th>
                <th className="text-right">신고</th>
                <th>만든 날</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => (
                <tr key={c.slug} className="border-b border-line last:border-b-0 [&>td]:py-2.5 [&>td]:pr-3">
                  <td className="whitespace-nowrap">
                    <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-fg-strong hover:underline">
                      {c.name}
                    </a>
                    <span className="ml-1.5 text-fg-weak">/{c.slug}</span>
                    {c.visibility === 'private' && <span className="ml-1.5">🔒</span>}
                    {c.adult && <span className="ml-1">🔞</span>}
                  </td>
                  <td className="text-fg-sub whitespace-nowrap">{c.ownerNickname ?? '-'}</td>
                  <td className="text-right tabular-nums text-fg-sub">{c.memberCount.toLocaleString()}</td>
                  <td className="text-right tabular-nums text-fg-sub">{c.postCount.toLocaleString()}</td>
                  <td className={cn('text-right tabular-nums', c.openReports ? 'font-bold text-danger-text' : 'text-fg-weak')}>{c.openReports}</td>
                  <td className="text-fg-weak whitespace-nowrap">{dateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Logs({ adminKey }: { adminKey: string }) {
  const list = useAdminQuery<AdminLog[]>(adminKey, '/logs');
  return (
    <section className={cn(ui.card, 'p-5')}>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : list.data.length === 0 ? (
        <p className={ui.empty}>아직 기록이 없어요</p>
      ) : (
        <ul className="list-none m-0 p-0">
          {list.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 border-b border-line last:border-b-0 text-sm">
              <span className="font-semibold text-fg-strong">{ACTION_LABEL[l.action] ?? l.action}</span>
              {l.target && <span className="text-fg-sub">{l.target}</span>}
              {l.detail && <span className="text-fg-sub">{l.detail}</span>}
              <span className="ml-auto text-[13px] text-fg-weak whitespace-nowrap">{dateTime(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 업데이트 공지를 새로 쓸 때 넣어 주는 틀 */
const UPDATE_TEMPLATE = '## ✨ 새 기능\n- \n\n## 🛠 바뀐 점\n- \n\n## 🐞 고친 문제\n- \n';

/** 공지 쓰기 · 고치기 */
function NoticeEditor({ adminKey, editing, onDone }: { adminKey: string; editing?: NoticeSummary; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<NoticeInput>({ title: '', body: editing ? '' : UPDATE_TEMPLATE, kind: 'update', pinned: false, version: '' });
  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  // 고칠 때는 본문까지 받아 온다 (목록에는 미리보기만 있다)
  useEffect(() => {
    if (!editing) return;
    void api<NoticeDetail>(`/api/notices/${editing.id}`).then((n) => {
      setForm({ title: n.title, body: n.body, kind: n.kind, pinned: n.pinned, version: n.version ?? '' });
      setLoaded(true);
    });
  }, [editing]);
  const set = (patch: Partial<NoticeInput>) => setForm((f) => ({ ...f, ...patch }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, version: form.version?.trim() || null };
      await adminApi(adminKey, editing ? `/notices/${editing.id}` : '/notices', { method: editing ? 'PUT' : 'POST', body });
      await qc.invalidateQueries({ queryKey: ['notices'] });
      toast(editing ? '공지를 고쳤어요' : '공지를 올렸어요');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };
  if (!loaded) return <div className={ui.spinner} />;
  return (
    <form className={cn(ui.card, 'p-5 flex flex-col gap-4')} onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[17px] font-bold text-fg-strong">{editing ? '공지 고치기' : '새 공지'}</h2>
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={onDone}>
          취소
        </button>
      </div>
      <div>
        <div className={ui.label}>종류</div>
        <div className={ui.chips}>
          {NOTICE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={cn(ui.chip, 'h-8')}
              aria-pressed={form.kind === k}
              onClick={() => set({ kind: k, body: k === 'update' && !form.body.trim() ? UPDATE_TEMPLATE : form.body })}
            >
              {NOTICE_KIND[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-4 max-[640px]:grid-cols-1">
        <label className="block">
          <span className={ui.label}>제목</span>
          <input className={ui.input} value={form.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} placeholder="예: 배지 도감이 생겼어요" required />
        </label>
        <label className="block">
          <span className={ui.label}>버전 (선택)</span>
          <input className={ui.input} value={form.version ?? ''} maxLength={20} onChange={(e) => set({ version: e.target.value })} placeholder="v1.1.0" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-fg-sub">
        <input type="checkbox" checked={!!form.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
        목록 맨 위에 고정
      </label>
      <MarkdownEditor value={form.body} onChange={(body) => set({ body })} label="내용" />
      <div className="flex justify-end gap-2">
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={saving || !form.title.trim() || !form.body.trim()}>
          {saving ? '저장하는 중…' : editing ? '고치기' : '올리기'}
        </button>
      </div>
    </form>
  );
}

/** 사이트 공지사항: 업데이트 소식 · 공지 · 이벤트 · 점검 (사이트의 /notices 에 보인다) */
function Notices({ adminKey }: { adminKey: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['notices', 'admin'], queryFn: () => api<NoticePage>('/api/notices', { query: { size: 50 } }) });
  const [editing, setEditing] = useState<NoticeSummary | 'new'>();
  const remove = async (n: NoticeSummary) => {
    if (!confirm(`'${n.title}' 공지를 지울까요?`)) return;
    try {
      await adminApi(adminKey, `/notices/${n.id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['notices'] });
      toast('공지를 지웠어요');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '지우지 못했어요');
    }
  };
  if (editing) return <NoticeEditor adminKey={adminKey} editing={editing === 'new' ? undefined : editing} onDone={() => setEditing(undefined)} />;
  const rows = [...(list.data?.pinned ?? []), ...(list.data?.items ?? [])];
  return (
    <section className={cn(ui.card, 'p-5')}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="m-0 text-sm text-fg-sub">
          올린 공지는 사이트의{' '}
          <a href="/notices" target="_blank" rel="noreferrer" className="text-primary font-semibold">
            공지사항
          </a>
          에 보이고, 30일 동안 홈 위쪽에 새 공지 안내가 떠요.
        </p>
        <button type="button" className={cn(ui.button, ui.primary, ui.small)} onClick={() => setEditing('new')}>
          새 공지
        </button>
      </div>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : rows.length === 0 ? (
        <p className={ui.empty}>아직 올린 공지가 없어요</p>
      ) : (
        <ul className="list-none m-0 p-0">
          {rows.map((n) => (
            <li key={n.id} className="flex items-center gap-3 py-3 border-t border-line text-sm">
              <span className={cn('flex-none px-1.5 py-px rounded-sm text-[12px] font-bold', NOTICE_KIND[n.kind as NoticeKind].className)}>{NOTICE_KIND[n.kind as NoticeKind].label}</span>
              <a href={`/notices/${n.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-fg-strong hover:text-primary">
                {n.pinned && '📌 '}
                {n.title}
                {n.version && <span className="ml-1.5 font-medium text-fg-weak">{n.version}</span>}
              </a>
              <span className="flex-none text-[13px] text-fg-weak tabular-nums">{noticeDate(n.createdAt)}</span>
              <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setEditing(n)}>
                고치기
              </button>
              <button type="button" className={cn(ui.button, ui.text, ui.small, 'text-danger-text')} onClick={() => remove(n)}>
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ClientErrorRow {
  id: string;
  kind: string;
  message: string;
  stack: string;
  path: string;
  userAgent: string;
  release?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}
const ERROR_KIND: Record<string, string> = { render: '화면 깨짐', error: '오류', rejection: '처리 안 된 요청', chunk: '새 버전 파일' };

/** 사용자 화면에서 난 오류: 같은 오류는 묶여서 횟수로. 고쳤으면 '해결' (다시 나면 새로 쌓인다) */
function ClientErrors({ adminKey }: { adminKey: string }) {
  const qc = useQueryClient();
  const list = useAdminQuery<ClientErrorRow[]>(adminKey, '/errors');
  const [open, setOpen] = useState<string>();
  const resolve = async (id: string) => {
    try {
      await adminApi(adminKey, `/errors/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['admin', '/errors'] });
      toast('해결로 표시했어요');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '처리하지 못했어요');
    }
  };
  return (
    <section className={cn(ui.card, 'p-5')}>
      <p className="mt-0 mb-3 text-sm text-fg-sub">사용자 화면에서 난 오류예요. 같은 오류는 한 줄로 묶이고, 주소는 경로만 · 사용자 정보는 남기지 않아요.</p>
      {!list.data ? (
        <div className={ui.spinner} />
      ) : list.data.length === 0 ? (
        <p className={ui.empty}>최근 오류가 없어요 🎉</p>
      ) : (
        <ul className="list-none m-0 p-0">
          {list.data.map((e) => (
            <li key={e.id} className="py-3 border-t border-line text-sm">
              <div className="flex items-start gap-3">
                <span className={cn('flex-none px-1.5 py-px rounded-sm text-[12px] font-bold', e.kind === 'render' ? 'bg-danger-weak text-danger-text' : 'bg-field text-fg-sub')}>
                  {ERROR_KIND[e.kind] ?? e.kind}
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === e.id ? undefined : e.id)}>
                  <span className="block font-semibold text-fg-strong break-all">{e.message}</span>
                  <span className="block mt-0.5 text-[13px] text-fg-weak">
                    {e.path} · {e.count.toLocaleString()}번 · 마지막 {dateTime(e.lastSeen)}
                    {e.release && ` · ${e.release}`}
                  </span>
                </button>
                <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => resolve(e.id)}>
                  해결
                </button>
              </div>
              {open === e.id && (
                <pre className="mt-2 mb-0 p-3 rounded-md bg-field text-[12px] text-fg-sub whitespace-pre-wrap break-all max-h-[320px] overflow-auto">
                  {e.stack || '(스택 없음)'}
                  {'\n\n'}
                  {e.userAgent}
                  {'\n'}처음 {dateTime(e.firstSeen)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────── 관리자 화면 ───────── */

const TABS = [
  ['overview', '현황'],
  ['reports', '신고'],
  ['users', '사용자'],
  ['channels', '채널'],
  ['notices', '공지사항'],
  ['errors', '오류'],
  ['logs', '기록'],
] as const;
type Tab = (typeof TABS)[number][0];

function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const me = useAdminQuery<{ email: string }>(adminKey, '/me');
  useEffect(() => {
    // 토큰이 만료되거나 권한이 사라지면 로그인 화면으로
    if (me.error instanceof ApiError && me.error.status === 401) onLogout();
  }, [me.error, onLogout]);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="flex items-center gap-4 h-14 max-w-[1100px] mx-auto px-5">
          <div className="flex items-center gap-2 font-extrabold text-fg-strong select-none">
            <LogoMark className="w-6 h-6" />
            루프 관리자
          </div>
          <nav className="flex gap-0.5 overflow-x-auto" aria-label="관리 메뉴">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className="h-9 px-3 rounded-sm text-[15px] font-semibold text-fg-sub whitespace-nowrap hover:bg-field aria-[current=page]:bg-primary-weak aria-[current=page]:text-primary"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm text-fg-sub whitespace-nowrap">
            <span className="max-[640px]:hidden">관리자</span>
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-[1100px] mx-auto px-5 py-6 flex flex-col gap-4">
        <h1 className="m-0 text-[22px] font-bold text-fg-strong">{TABS.find(([id]) => id === tab)![1]}</h1>
        {tab === 'overview' && <Overview adminKey={adminKey} goReports={() => setTab('reports')} />}
        {tab === 'reports' && <Reports adminKey={adminKey} />}
        {tab === 'users' && <Users adminKey={adminKey} />}
        {tab === 'channels' && <Channels adminKey={adminKey} />}
        {tab === 'notices' && <Notices adminKey={adminKey} />}
        {tab === 'errors' && <ClientErrors adminKey={adminKey} />}
        {tab === 'logs' && <Logs adminKey={adminKey} />}
      </main>
    </div>
  );
}

/**
 * 관리자 앱. 주소의 첫 칸이 ADMIN_KEY 일 때만 열린다.
 * 서버에 키가 맞는지 먼저 물어보고, 아니면 onDenied 로 평범한 '없는 페이지'를 보여 주게 한다.
 * 검색 엔진에 잡히지 않도록 noindex 를 붙이고, 일반 사이트 화면(헤더 · 메뉴)과 섞지 않는다.
 */
export default function AdminApp({ adminKey, onDenied }: { adminKey: string; onDenied: () => void }) {
  const [gate, setGate] = useState<'checking' | 'ok'>('checking');
  const [loggedIn, setLoggedIn] = useState(() => !!adminToken.get());
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    adminApi(adminKey, '/gate').then(
      () => alive && setGate('ok'),
      () => alive && onDenied(),
    );
    return () => {
      alive = false;
    };
  }, [adminKey, onDenied]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = '루프 관리자';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    // 비밀 주소가 다른 곳으로 넘어가지 않게 (Referer 를 보내지 않는다)
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    document.head.appendChild(referrer);
    return () => {
      document.title = prevTitle;
      meta.remove();
      referrer.remove();
    };
  }, []);

  const logout = () => {
    adminToken.set(null);
    qc.removeQueries({ queryKey: ['admin'] });
    setLoggedIn(false);
  };

  if (gate === 'checking') return null;
  return (
    <>
      {loggedIn ? <Dashboard adminKey={adminKey} onLogout={logout} /> : <AdminLogin adminKey={adminKey} onDone={() => setLoggedIn(true)} />}
      <Toaster />
    </>
  );
}
