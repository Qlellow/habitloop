import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, CODE_LENGTH, REPORT_REASONS, timeAgo } from '@loop/shared';
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
  adminNickname?: string;
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
          {step === 'password' ? '관리자로 지정된 계정만 들어올 수 있어요.' : `${email} 로 보낸 인증번호를 입력해 주세요.`}
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
                    {u.admin && <span className={cn(ui.badge, 'ml-1.5')}>관리자</span>}
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
              <span className="ml-auto text-[13px] text-fg-weak whitespace-nowrap">
                {l.adminNickname ?? '-'} · {dateTime(l.createdAt)}
              </span>
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
  ['logs', '기록'],
] as const;
type Tab = (typeof TABS)[number][0];

function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const me = useAdminQuery<{ nickname: string; email: string }>(adminKey, '/me');
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
            <span className="max-[640px]:hidden">{me.data?.nickname}</span>
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
