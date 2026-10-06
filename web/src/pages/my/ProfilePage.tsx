import { useRef, useState, type FormEvent } from 'react';
import {
  BANNER_PRESETS,
  CUSTOM_BANNER_COST,
  checkNickname,
  compact,
  passwordProblem,
  passwordStrength,
  uploadPostImage,
  useAuth,
  useChangePassword,
  useSetAvatar,
  useSetBanner,
  useUnlockBanner,
  useUpdateProfile,
  type User,
} from '@loop/shared';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CropModal } from '../../components/CropModal';
import { ProfileBanner } from '../../components/ProfileBanner';
import { UserAvatar } from '../../components/UserAvatar';
import { cropToBlob, toSquareIcon } from '../../lib/image';
import { PasswordStrength } from '../../components/Auth';
import { EyeIcon, EyeOffIcon } from '../../components/Icons';
import { toast } from '../../components/Toast';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

function NicknameForm({ current }: { current: string }) {
  const update = useUpdateProfile();
  const [nickname, setNickname] = useState(current);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string>();
  const trimmed = nickname.trim();
  const valid = trimmed.length >= 2 && trimmed !== current;

  // 저장을 누르면 먼저 중복을 확인하고, 쓸 수 있을 때만 바꾼다
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || checking) return;
    setChecking(true);
    setProblem(undefined);
    try {
      const res = await checkNickname(trimmed);
      if (!res.available) return setProblem(res.reason ?? '이미 사용 중인 닉네임이에요');
      update.mutate({ nickname: trimmed }, { onSuccess: () => toast('닉네임을 바꿨어요') });
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form className={cn(ui.card, s.section)} onSubmit={submit}>
      <h2 className={s.sectionTitle}>닉네임</h2>
      <p className={s.sectionDesc}>글과 댓글에 보이는 이름이에요. 바꾸면 이전 글에도 새 닉네임이 보여요.</p>
      <div className={s.row}>
        <input
          className={ui.input}
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setProblem(undefined);
          }}
          maxLength={20}
          aria-label="닉네임"
          aria-invalid={!!problem}
        />
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || checking || update.isPending}>
          {checking ? '확인 중…' : '저장'}
        </button>
      </div>
      {(problem ?? update.error?.message) && (
        <p className={ui.error} style={{ margin: '10px 0 0' }}>
          {problem ?? update.error?.message}
        </p>
      )}
    </form>
  );
}

/** 비밀번호 칸 + 오른쪽 눈 버튼 (로그인·회원가입처럼 보기/숨기기) */
function PasswordInput({ value, onChange, autoComplete, placeholder, label }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder?: string;
  label: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <span className="relative block">
      <input
        className={cn(ui.input, 'pr-11')}
        type={reveal ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        autoCapitalize="off"
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-sm text-fg-weak hover:text-fg-sub"
        aria-label={reveal ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={reveal}
        onClick={() => setReveal((v) => !v)}
      >
        {reveal ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
      </button>
    </span>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const problem = form.next ? passwordProblem(form.next) : undefined;
  // 회원가입과 같이 '강함' 이상이어야 바꿀 수 있다
  const strongEnough = passwordStrength(form.next).level >= 3;
  const valid = form.current.length > 0 && !problem && strongEnough && !!form.next && form.next === form.confirm;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    change.mutate(
      { currentPassword: form.current, newPassword: form.next },
      {
        onSuccess: () => {
          toast('비밀번호를 바꿨어요. 다른 기기는 모두 로그아웃했어요');
          setForm({ current: '', next: '', confirm: '' });
        },
      },
    );
  };

  return (
    <form className={cn(ui.card, s.section)} onSubmit={submit}>
      <h2 className={s.sectionTitle}>비밀번호</h2>
      <p className={s.sectionDesc}>지금 비밀번호를 확인한 뒤에 바꿀 수 있어요.</p>
      <div className={ui.field}>
        <span className={ui.label}>지금 비밀번호</span>
        <PasswordInput label="지금 비밀번호" autoComplete="current-password" value={form.current} onChange={set('current')} />
      </div>
      <div className={ui.field}>
        <span className={ui.label}>새 비밀번호</span>
        <PasswordInput label="새 비밀번호" autoComplete="new-password" value={form.next} onChange={set('next')} placeholder="8자 이상, 숫자·특수문자 포함" />
        {/* 회원가입처럼 강도 막대로 보여 준다 */}
        <div className="mt-2">
          <PasswordStrength value={form.next} />
          {/* 길이·숫자·특수문자는 막대 아래에 나오므로, 쓸 수 없는 글자 같은 그 밖의 문제만 따로 */}
          {problem && passwordStrength(form.next).missing.length === 0 && (
            <p className={ui.help} style={{ color: 'var(--danger-text)' }}>
              {problem}
            </p>
          )}
        </div>
      </div>
      <div className={ui.field}>
        <span className={ui.label}>새 비밀번호 확인</span>
        <PasswordInput label="새 비밀번호 확인" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {mismatch && <p className={ui.help} style={{ color: 'var(--danger-text)' }}>비밀번호가 일치하지 않습니다.</p>}
      </div>
      {change.error && <p className={ui.error}>{change.error.message}</p>}
      <div className={s.actions}>
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || change.isPending}>
          비밀번호 바꾸기
        </button>
      </div>
    </form>
  );
}

/** 고른 사진을 자르기 창에서 다듬은 뒤 올린다 (프로필은 1:1 원형, 배너는 3:1) */
function useImagePick(onPicked: (file: File) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) onPicked(file);
      }}
    />
  );
  return { open: () => input.current?.click(), element };
}

function AvatarSection({ user }: { user: User }) {
  const setAvatar = useSetAvatar();
  const [cropping, setCropping] = useState<{ file: File; url: string }>();
  const [busy, setBusy] = useState(false);
  const pick = useImagePick((file) => setCropping({ file, url: URL.createObjectURL(file) }));
  const close = () => {
    if (cropping) URL.revokeObjectURL(cropping.url);
    setCropping(undefined);
  };
  const apply = async (crop: { x: number; y: number; w: number; h: number }) => {
    if (!cropping) return;
    setBusy(true);
    try {
      const { id } = await uploadPostImage(await toSquareIcon(cropping.file, crop));
      await setAvatar.mutateAsync(id);
      toast('프로필 사진을 바꿨어요');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={cn(ui.card, s.section)}>
      <h2 className={s.sectionTitle}>프로필 사진</h2>
      <p className={s.sectionDesc}>글 · 댓글 · 프로필에 보여요. 사진을 고르면 원형으로 보일 영역을 정할 수 있어요.</p>
      <div className="flex items-center gap-4">
        <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={72} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(ui.button, ui.secondary, ui.small)} onClick={pick.open} disabled={busy}>
            {user.avatarUrl ? '사진 바꾸기' : '사진 올리기'}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small)}
              disabled={setAvatar.isPending}
              onClick={() => setAvatar.mutate(null, { onSuccess: () => toast('기본 프로필로 바꿨어요'), onError: (e) => toast(e.message) })}
            >
              기본으로
            </button>
          )}
        </div>
      </div>
      {pick.element}
      {cropping && (
        <CropModal
          src={cropping.url}
          title="프로필 사진 자르기"
          shapes={false}
          initialShape="circle"
          aspect={1}
          applyLabel={busy ? '올리는 중…' : '이 영역으로 설정'}
          onApply={({ crop }) => void apply(crop)}
          onClose={close}
        />
      )}
    </section>
  );
}

/**
 * 배너: 기본 배너는 누구나 무료로 고를 수 있고, 커스텀 배너는 포인트로 한 번 열면 계속 바꿀 수 있다.
 */
function BannerSection({ user }: { user: User }) {
  const setBanner = useSetBanner();
  const unlock = useUnlockBanner();
  const [asking, setAsking] = useState(false);
  const [cropping, setCropping] = useState<{ file: File; url: string }>();
  const [busy, setBusy] = useState(false);
  const pick = useImagePick((file) => setCropping({ file, url: URL.createObjectURL(file) }));
  const points = user.points ?? 0;
  const close = () => {
    if (cropping) URL.revokeObjectURL(cropping.url);
    setCropping(undefined);
  };
  const choose = (banner: string | null) => setBanner.mutate(banner, { onError: (e) => toast(e.message) });
  const apply = async (crop: { x: number; y: number; w: number; h: number }) => {
    if (!cropping) return;
    setBusy(true);
    try {
      const { id } = await uploadPostImage(await cropToBlob(cropping.file, crop, 1500, 500));
      await setBanner.mutateAsync(`i:${id}`);
      toast('배너를 바꿨어요');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const custom = user.banner?.startsWith('i:');
  return (
    <section className={cn(ui.card, s.section)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={s.sectionTitle}>배너</h2>
          <p className={s.sectionDesc}>프로필 위쪽에 보여요. 기본 배너는 무료, 커스텀 배너는 포인트로 열 수 있어요.</p>
        </div>
        <span className="flex-none px-3 py-1.5 rounded-full bg-field text-sm font-bold text-fg-strong" title="가진 포인트">
          {compact(points)}P
        </span>
      </div>
      <ProfileBanner banner={user.banner} className="rounded-md border border-border mb-4" />
      <div className="text-[13px] font-semibold text-fg-sub mb-2">기본 배너 · 무료</div>
      <div className="grid grid-cols-4 gap-2 max-[520px]:grid-cols-3" role="radiogroup" aria-label="기본 배너">
        <button
          type="button"
          role="radio"
          aria-checked={!user.banner}
          onClick={() => choose(null)}
          className="h-12 rounded-md border border-dashed border-border text-[13px] text-fg-sub aria-checked:ring-2 aria-checked:ring-primary"
        >
          없음
        </button>
        {BANNER_PRESETS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={user.banner === `p:${b.id}`}
            aria-label={b.label}
            title={b.label}
            onClick={() => choose(`p:${b.id}`)}
            className="h-12 rounded-md transition-transform hover:scale-[1.03] aria-checked:ring-2 aria-checked:ring-primary aria-checked:ring-offset-2 aria-checked:ring-offset-surface"
            style={{ background: b.background }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-5">
        <span className="text-[13px] font-semibold text-fg-sub mr-auto">
          커스텀 배너 {user.customBanner ? <span className={cn(ui.badge, 'ml-1')}>열림</span> : `· ${CUSTOM_BANNER_COST}P`}
        </span>
        {user.customBanner ? (
          <button type="button" className={cn(ui.button, custom ? ui.ghost : ui.secondary, ui.small)} onClick={pick.open} disabled={busy}>
            {custom ? '사진 바꾸기' : '사진 올리기'}
          </button>
        ) : (
          <button
            type="button"
            className={cn(ui.button, ui.secondary, ui.small)}
            disabled={points < CUSTOM_BANNER_COST || unlock.isPending}
            title={points < CUSTOM_BANNER_COST ? `포인트가 ${CUSTOM_BANNER_COST - points}P 모자라요` : undefined}
            onClick={() => setAsking(true)}
          >
            {CUSTOM_BANNER_COST}P 로 열기
          </button>
        )}
      </div>
      {!user.customBanner && points < CUSTOM_BANNER_COST && (
        <p className={cn(ui.help, 'mt-1.5')}>포인트가 {CUSTOM_BANNER_COST - points}P 모자라요.</p>
      )}
      <ConfirmDialog
        open={asking}
        title="커스텀 배너를 열까요?"
        message={`${CUSTOM_BANNER_COST}P 를 써요. 한 번 열면 그 뒤로는 계속 바꿀 수 있어요.`}
        confirmLabel={`${CUSTOM_BANNER_COST}P 로 열기`}
        onConfirm={() => unlock.mutate(undefined, { onSuccess: () => toast('커스텀 배너를 열었어요'), onError: (e) => toast(e.message) })}
        onClose={() => setAsking(false)}
      />
      {pick.element}
      {cropping && (
        <CropModal
          src={cropping.url}
          title="배너 자르기"
          shapes={false}
          aspect={3}
          applyLabel={busy ? '올리는 중…' : '이 영역으로 설정'}
          onApply={({ crop }) => void apply(crop)}
          onClose={close}
        />
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>내 정보 수정</h1>
      </div>
      {/* 닉네임 → 프로필 사진 → 배너 → 비밀번호 (포인트는 '포인트' 탭) (이메일은 바꿀 수 없으니 왼쪽 메뉴에서만 보인다) */}
      <NicknameForm key={user.nickname} current={user.nickname} />
      <AvatarSection user={user} />
      <BannerSection user={user} />
      <PasswordForm />
    </>
  );
}
