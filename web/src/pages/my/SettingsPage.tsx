import { useState, type FormEvent } from 'react';
import {
  CODE_LENGTH,
  timeAgo,
  useAuth,
  useIdentities,
  useLinkIdentity,
  useLoginSessions,
  useRevokeSession,
  useTwoFactor,
  useUnlinkIdentity,
  useVerifyAge,
  useWithdraw,
} from '@loop/shared';
import { useLeaveThenSignOut } from '../../lib/authNav';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PROVIDERS } from '../../components/SocialLogin';
import { CodeField, CodeTimer, useCodeTimer } from '../../components/CodeField';
import { toast } from '../../components/Toast';
import { usePhone } from '../../lib/media';
import { updateSettings, useSettings, type Settings } from '../../lib/settings';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

function Segment<K extends keyof Settings>({
  name,
  value,
  options,
}: {
  name: K;
  value: Settings[K];
  options: [Settings[K], string][];
}) {
  return (
    <div className={s.segment} role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          className={s.segmentButton}
          role="radio"
          aria-checked={value === v}
          onClick={() => updateSettings({ [name]: v } as Partial<Settings>)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * 2단계 인증 (계정 설정이라 이 브라우저가 아니라 계정에 저장된다).
 * 켜기: 내 이메일로 받은 번호 확인 → 켜짐 + 알림 메일 / 끄기: 비밀번호 확인 → 꺼짐 + 알림 메일
 */
function TwoFactorOption() {
  const { user } = useAuth();
  const { sendCode, enable, disable } = useTwoFactor();
  const timer = useCodeTimer();
  const [step, setStep] = useState<'idle' | 'code' | 'password'>('idle');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const on = !!user?.twoFactorEnabled;

  const reset = () => {
    setStep('idle');
    setCode('');
    setPassword('');
    enable.reset();
    disable.reset();
  };
  const requestCode = () =>
    sendCode.mutate(undefined, {
      onSuccess: () => {
        setStep('code');
        setCode('');
        enable.reset();
        timer.restart();
        toast(`${user?.email}(으)로 인증번호를 보냈어요`);
      },
      onError: (e) => toast(e.message),
    });
  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    enable.mutate(code, {
      onSuccess: () => {
        reset();
        toast('2단계 인증을 켰어요. 알림 메일도 보냈어요');
      },
      onError: () => setCode(''),
    });
  };
  const confirmPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    disable.mutate(password, {
      onSuccess: () => {
        reset();
        toast('2단계 인증을 껐어요');
      },
    });
  };

  return (
    <>
      <div className={s.option}>
        <div>
          <div className={s.optionLabel}>
            2단계 인증 {on && <span className={cn(ui.badge, 'ml-1 align-[1px]')}>사용 중</span>}
          </div>
          <div className={s.optionDesc}>
            로그인할 때 비밀번호와 함께 {user?.email}(으)로 받은 인증번호를 입력해요. 비밀번호가 새어 나가도 계정을 지킬 수 있어요.
          </div>
        </div>
        {step === 'idle' &&
          (on ? (
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setStep('password')}>
              끄기
            </button>
          ) : (
            <button type="button" className={cn(ui.button, ui.primary, ui.small)} disabled={sendCode.isPending} onClick={requestCode}>
              {sendCode.isPending ? '보내는 중…' : '켜기'}
            </button>
          ))}
      </div>
      {step === 'code' && (
        <form className={s.inlineForm} onSubmit={confirmCode} noValidate>
          <p className={s.optionDesc}>메일로 받은 인증번호 {CODE_LENGTH}자리를 입력하면 2단계 인증이 켜져요.</p>
          <CodeField value={code} onChange={setCode} autoFocus invalid={!!enable.error && !code} />
          <CodeTimer timer={timer} pending={sendCode.isPending} onResend={requestCode} />
          {enable.error && <p className={cn(ui.error, 'mb-0')}>{enable.error.message}</p>}
          <div className={s.inlineActions}>
            <span className="flex-1" />
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={reset}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={code.length !== CODE_LENGTH || timer.expired || enable.isPending}>
              {enable.isPending ? '확인 중…' : '켜기'}
            </button>
          </div>
        </form>
      )}
      {step === 'password' && (
        <form className={s.inlineForm} onSubmit={confirmPassword} noValidate>
          <p className={s.optionDesc}>본인 확인을 위해 비밀번호를 입력해 주세요.</p>
          <input
            className={ui.input}
            type="password"
            autoComplete="current-password"
            aria-label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {disable.error && <p className={cn(ui.error, 'mb-0')}>{disable.error.message}</p>}
          <div className={s.inlineActions}>
            <span className="flex-1" />
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={reset}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.danger, ui.ghost, ui.small)} disabled={!password || disable.isPending}>
              {disable.isPending ? '확인 중…' : '끄기'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/**
 * 나이 확인: 생년월일을 입력하면 만 19세 이상 채널·카테고리를 볼 수 있다. (테스트 중이라 다시 바꿀 수 있다)
 * (휴대폰 본인인증 같은 외부 인증은 아직 붙이지 않았다)
 */
function AgeOption() {
  const { user } = useAuth();
  const verify = useVerifyAge();
  const [open, setOpen] = useState(false);
  const [birth, setBirth] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!birth) return;
    verify.mutate(birth, {
      onSuccess: (u) => {
        setOpen(false);
        toast(u.adult ? '만 19세 이상으로 확인했어요' : '만 19세 미만이라 19세 이상 채널은 볼 수 없어요');
      },
    });
  };
  return (
    <>
      <div className={s.option}>
        <div>
          <div className={s.optionLabel}>
            나이 확인{' '}
            {user?.ageChecked && <span className={cn(ui.badge, 'ml-1 align-[1px]')}>{user.adult ? '만 19세 이상' : '만 19세 미만'}</span>}
          </div>
          <div className={s.optionDesc}>
            {user?.ageChecked
              ? `생년월일 ${user.birthDate ?? ''} 로 확인했어요. 지금은 테스트 중이라 바꿀 수 있어요.`
              : '생년월일을 확인하면 만 19세 이상만 볼 수 있는 채널·카테고리를 볼 수 있어요.'}
          </div>
        </div>
        {!open && (
          <button
            type="button"
            className={cn(ui.button, user?.ageChecked ? ui.ghost : ui.secondary, ui.small)}
            onClick={() => {
              setBirth(user?.birthDate ?? '');
              verify.reset();
              setOpen(true);
            }}
          >
            {user?.ageChecked ? '생년월일 바꾸기' : '확인하기'}
          </button>
        )}
      </div>
      {open && (
        <form className={s.inlineForm} onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1.5">
            <span className={s.optionDesc}>생년월일</span>
            <input className={ui.input} type="date" min="1900-01-01" max={today} value={birth} onChange={(e) => setBirth(e.target.value)} autoFocus />
          </label>
          {verify.error && <p className={cn(ui.error, 'mb-0')}>{verify.error.message}</p>}
          <div className={s.inlineActions}>
            <span className="flex-1" />
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={!birth || verify.isPending}>
              {verify.isPending ? '확인 중…' : '확인'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

const isPhone = (device: string) => /iOS|Android|앱/.test(device);

/**
 * 로그인한 기기: 기기마다 따로 로그인(세션)돼 있다. 다른 기기를 골라 로그아웃하면 그 기기의 토큰은 서버에서 바로 폐기된다.
 */
/**
 * 소셜 로그인 연동: 연결하면 그 소셜 계정으로도 이 계정에 로그인할 수 있다.
 * 비밀번호가 없는(소셜로만 가입한) 계정은 마지막 연결을 끊을 수 없다 (서버도 막는다)
 */
function SocialAccounts() {
  const ids = useIdentities();
  const link = useLinkIdentity();
  const unlink = useUnlinkIdentity();
  const [asking, setAsking] = useState<(typeof PROVIDERS)[number]>();
  const linked = new Map(ids.data?.linked.map((l) => [l.provider, l]));
  const lastOne = !ids.data?.hasPassword && linked.size <= 1;

  return (
    <>
      <div className={s.option}>
        <div>
          <div className={s.optionLabel}>소셜 로그인 연동</div>
          <div className={s.optionDesc}>연결해 두면 그 계정으로도 바로 로그인할 수 있어요.</div>
        </div>
      </div>
      {ids.error && <p className={cn(ui.error, 'mb-0')}>{ids.error.message}</p>}
      {/* 아래 '로그인한 기기'와 붙어 보이지 않게 아래쪽을 띄운다 */}
      <ul className={cn(s.sessionList, 'mb-4')} aria-busy={ids.isPending}>
        {PROVIDERS.map((p) => {
          const item = linked.get(p.id);
          const enabled = ids.data?.enabled.includes(p.id) ?? true;
          return (
            <li key={p.id} className={s.session}>
              <span className={cn('flex-none grid place-items-center w-9 h-9 rounded-full', p.className)} aria-hidden>
                <span className="scale-[0.8]">
                  <p.logo />
                </span>
              </span>
              <div className="flex-1 min-w-0">
                <div className={s.optionLabel}>
                  {p.label} {item && <span className={cn(ui.badge, 'ml-1 align-[1px]')}>연결됨</span>}
                </div>
                {/* 연결된 곳은 '연결됨' 배지로 충분해서 연결 시각은 보여 주지 않는다 */}
                {/* 불러오는 동안은 '연결되지 않았어요'가 잠깐 보이지 않게 자리만 잡아 둔다 */}
                {ids.isPending ? (
                  <span className={cn(ui.skeleton, 'block mt-1 mb-[3px]')} style={{ width: 96, height: 14 }} />
                ) : (
                  !item && <div className={s.optionDesc}>{enabled ? '연결되지 않았어요' : '아직 준비 중이에요'}</div>
                )}
              </div>
              {ids.isPending ? (
                <span className={cn(ui.skeleton, 'flex-none w-[52px] h-8')} aria-hidden />
              ) : item ? (
                <button
                  type="button"
                  className={cn(ui.button, ui.text, ui.danger, ui.small)}
                  disabled={unlink.isPending}
                  title={lastOne ? '비밀번호를 정하거나 다른 소셜 계정을 연결한 뒤에 해제할 수 있어요' : undefined}
                  onClick={() => (lastOne ? toast('로그인할 방법이 없어져요. 먼저 비밀번호를 정하거나 다른 소셜 계정을 연결해 주세요') : setAsking(p))}
                >
                  해제
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(ui.button, ui.secondary, ui.small)}
                  disabled={!enabled || link.isPending || ids.isPending}
                  onClick={() => link.mutate(p.id, { onError: (e) => toast(e.message) })}
                >
                  연결
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!asking}
        title={`${asking?.label ?? ''} 연결을 해제할까요?`}
        message="해제하면 그 소셜 계정으로는 이 계정에 로그인할 수 없어요. 언제든 다시 연결할 수 있어요."
        confirmLabel="해제"
        danger
        onConfirm={() => {
          const p = asking!;
          unlink.mutate(p.id, { onSuccess: () => toast(`${p.label} 연결을 해제했어요`), onError: (e) => toast(e.message) });
        }}
        onClose={() => setAsking(undefined)}
      />
    </>
  );
}

/** 탈퇴하면 어떻게 되는지 (팝업에서 보여 준다) */
const WITHDRAW_NOTES = [
  '작성한 글과 댓글은 지워지지 않고, 작성자는 \'탈퇴한 사용자\'로 보여요. 지우고 싶은 글은 탈퇴 전에 직접 지워 주세요.',
  '이메일 · 프로필 사진 · 배너 · 생년월일 · 소셜 로그인 연동 · 포인트 · 배지 · 팔로우한 채널은 모두 지워지고 되돌릴 수 없어요.',
  '내가 만든 채널은 관리자 → 매니저 → 팔로워 순으로 다음 사람에게 넘어가요.',
  '같은 이메일로 다시 가입할 수 있지만, 지금 계정은 되살릴 수 없어요.',
];

/** 회원 탈퇴: 안내 확인 → 가입한 이메일로 받은 인증번호 → 탈퇴 */
function WithdrawDialog({ onClose }: { onClose: () => void }) {
  const leaveThenSignOut = useLeaveThenSignOut();
  const { sendCode, withdraw, finish } = useWithdraw();
  const timer = useCodeTimer();
  const [agreed, setAgreed] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState('');

  const requestCode = () =>
    sendCode.mutate(undefined, {
      onSuccess: (r) => {
        setSentTo(r.maskedEmail ?? '가입한 이메일');
        setCode('');
        withdraw.reset();
        timer.restart();
      },
      onError: (e) => toast(e.message),
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    withdraw.mutate(code, {
      onSuccess: () => {
        onClose();
        // 마이페이지를 떠나 홈으로 옮겨 간 뒤에 로그아웃 (lib/authNav)
        leaveThenSignOut('/', finish);
        toast('탈퇴했어요. 그동안 루프와 함께해 주셔서 고마워요');
      },
      onError: () => setCode(''),
    });
  };

  return (
    <Modal onClose={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="w-full max-w-[440px] p-6 rounded-xl border border-border bg-surface shadow-pop"
        onSubmit={submit}
        noValidate
      >
        <h2 id="withdraw-title" className="m-0 text-lg font-bold text-fg-strong">
          정말 탈퇴할까요?
        </h2>
        <ul className="mt-3 mb-0 pl-5 list-disc text-sm text-fg-sub space-y-1.5">
          {WITHDRAW_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-fg-strong cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[var(--danger)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          위 내용을 확인했고, 탈퇴할게요
        </label>
        {sentTo && (
          <div className="mt-4">
            <p className={cn(s.optionDesc, 'mb-2')}>
              {sentTo}(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
            </p>
            <CodeField value={code} onChange={setCode} autoFocus invalid={!!withdraw.error && !code} />
            <CodeTimer timer={timer} pending={sendCode.isPending} onResend={requestCode} />
            {withdraw.error && <p className={cn(ui.error, 'mb-0')}>{withdraw.error.message}</p>}
          </div>
        )}
        <div className="flex gap-2 mt-6">
          <button type="button" className={cn(ui.button, ui.ghost, 'flex-1')} onClick={onClose}>
            취소
          </button>
          {sentTo ? (
            <button
              type="submit"
              className={cn(ui.button, 'bg-danger text-white hover:brightness-95 flex-1')}
              disabled={!agreed || code.length !== CODE_LENGTH || timer.expired || withdraw.isPending}
            >
              {withdraw.isPending ? '탈퇴하는 중…' : '탈퇴하기'}
            </button>
          ) : (
            <button
              type="button"
              className={cn(ui.button, 'bg-danger text-white hover:brightness-95 flex-1')}
              disabled={!agreed || sendCode.isPending}
              onClick={requestCode}
            >
              {sendCode.isPending ? '보내는 중…' : '인증번호 받기'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function WithdrawOption() {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.option}>
      <div>
        <div className={s.optionLabel}>회원 탈퇴</div>
        <div className={s.optionDesc}>계정을 닫아요. 작성한 글과 댓글은 남고, 개인정보는 지워져요.</div>
      </div>
      <button type="button" className={cn(ui.button, ui.text, ui.danger, ui.small)} onClick={() => setOpen(true)}>
        회원 탈퇴
      </button>
      {open && <WithdrawDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function LoginSessions() {
  const sessions = useLoginSessions();
  const revoke = useRevokeSession();
  const list = sessions.data ?? [];
  const others = list.filter((d) => !d.current).length;

  const logout = (id?: string) =>
    revoke.mutate(id, {
      onSuccess: () => toast(id ? '그 기기에서 로그아웃했어요' : '다른 기기에서 모두 로그아웃했어요'),
      onError: (e) => toast(e.message),
    });

  return (
    <>
      <div className={s.option}>
        <div>
          <div className={s.optionLabel}>로그인한 기기</div>
          <div className={s.optionDesc}>모르는 기기가 있으면 로그아웃하고 비밀번호를 바꿔 주세요. 로그아웃한 기기는 다시 로그인해야 해요.</div>
        </div>
        {others > 0 && (
          <button type="button" className={cn(ui.button, ui.ghost, ui.small)} disabled={revoke.isPending} onClick={() => logout()}>
            다른 기기 모두 로그아웃
          </button>
        )}
      </div>
      {sessions.isPending && <p className={s.optionDesc}>불러오는 중…</p>}
      {sessions.error && <p className={cn(ui.error, 'mb-0')}>{sessions.error.message}</p>}
      {list.length > 0 && (
        <ul className={s.sessionList}>
          {list.map((d) => (
            <li key={d.id} className={s.session}>
              <span className={s.sessionIcon} aria-hidden>
                {isPhone(d.device) ? '📱' : '💻'}
              </span>
              <div className="flex-1 min-w-0">
                <div className={s.optionLabel}>
                  {d.device} {d.current && <span className={cn(ui.badge, 'ml-1 align-[1px]')}>이 기기</span>}
                </div>
                <div className={s.optionDesc}>
                  {d.current ? '지금 사용 중' : `최근 사용 ${timeAgo(d.lastUsedAt)}`} · {timeAgo(d.createdAt)} 로그인
                </div>
              </div>
              {!d.current && (
                <button
                  type="button"
                  className={cn(ui.button, ui.text, ui.danger, ui.small)}
                  disabled={revoke.isPending}
                  onClick={() => logout(d.id)}
                >
                  로그아웃
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const phone = usePhone();
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>설정</h1>
        <p className={s.desc}>화면·글쓰기 설정은 바로 적용되고 이 브라우저에 저장돼요.</p>
      </div>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>보안</h2>
        <TwoFactorOption />
        <AgeOption />
        <SocialAccounts />
        <LoginSessions />
      </section>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>화면</h2>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>테마</div>
            <div className={s.optionDesc}>시스템 설정을 고르면 기기의 라이트/다크 모드를 따라가요.</div>
          </div>
          <Segment
            name="theme"
            value={settings.theme}
            options={[
              ['system', '시스템 설정'],
              ['light', '라이트'],
              ['dark', '다크'],
            ]}
          />
        </div>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>글 목록 미리보기</div>
            <div className={s.optionDesc}>글 목록에서 제목 아래에 본문 두 줄을 보여 줘요.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.showExcerpt}
            aria-label="글 목록 미리보기"
            className={s.switch}
            onClick={() => updateSettings({ showExcerpt: !settings.showExcerpt })}
          />
        </div>
      </section>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>글쓰기</h2>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>편집기 기본 보기</div>
            <div className={s.optionDesc}>
              글쓰기 화면을 열 때 처음 보이는 방식이에요.{!phone && ' (좁은 화면에서는 나란히 대신 작성)'}
            </div>
          </div>
          {/* 폰에서는 나란히 보기를 쓸 수 없으므로 선택지에서 뺀다 (나란히로 저장돼 있으면 작성으로 열린다) */}
          <Segment
            name="editorMode"
            value={phone && settings.editorMode === 'split' ? 'write' : settings.editorMode}
            options={
              phone
                ? [
                    ['write', '작성'],
                    ['preview', '미리보기'],
                  ]
                : [
                    ['write', '작성'],
                    ['split', '나란히'],
                    ['preview', '미리보기'],
                  ]
            }
          />
        </div>
      </section>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>계정</h2>
        <WithdrawOption />
      </section>
    </>
  );
}
