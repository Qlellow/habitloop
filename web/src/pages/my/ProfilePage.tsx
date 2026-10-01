import { useState, type FormEvent } from 'react';
import { passwordProblem, useAuth, useChangePassword, useUpdateProfile } from '@loop/shared';
import { toast } from '../../components/Toast';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

function NicknameForm({ current }: { current: string }) {
  const update = useUpdateProfile();
  const [nickname, setNickname] = useState(current);
  const trimmed = nickname.trim();
  const valid = trimmed.length >= 2 && trimmed !== current;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    update.mutate({ nickname: trimmed }, { onSuccess: () => toast('닉네임을 바꿨어요') });
  };

  return (
    <form className={cn(ui.card, s.section)} onSubmit={submit}>
      <h2 className={s.sectionTitle}>닉네임</h2>
      <p className={s.sectionDesc}>글과 댓글에 보이는 이름이에요. 바꾸면 이전 글에도 새 닉네임이 보여요.</p>
      <div className={s.row}>
        <input
          className={ui.input}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          aria-label="닉네임"
        />
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || update.isPending}>
          저장
        </button>
      </div>
      {update.error && <p className={ui.error} style={{ margin: '10px 0 0' }}>{update.error.message}</p>}
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const problem = form.next ? passwordProblem(form.next) : undefined;
  const valid = form.current.length > 0 && !problem && !!form.next && form.next === form.confirm;

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
      <label className={ui.field}>
        <span className={ui.label}>지금 비밀번호</span>
        <input className={ui.input} type="password" autoComplete="current-password" value={form.current} onChange={set('current')} />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>새 비밀번호</span>
        <input
          className={ui.input}
          type="password"
          autoComplete="new-password"
          value={form.next}
          onChange={set('next')}
          placeholder="8자 이상, 숫자·특수문자 포함"
        />
        {problem ? (
          <p className={ui.help} style={{ color: 'var(--danger)' }}>
            {problem}
          </p>
        ) : (
          <p className={ui.help}>영문·숫자·특수문자로 8자 이상, 숫자와 특수문자를 하나 이상 넣어 주세요.</p>
        )}
      </label>
      <label className={ui.field}>
        <span className={ui.label}>새 비밀번호 확인</span>
        <input className={ui.input} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {mismatch && <p className={ui.help} style={{ color: 'var(--danger)' }}>새 비밀번호가 서로 달라요</p>}
      </label>
      {change.error && <p className={ui.error}>{change.error.message}</p>}
      <div className={s.actions}>
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || change.isPending}>
          비밀번호 바꾸기
        </button>
      </div>
    </form>
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
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>이메일</h2>
        <p className={s.sectionDesc}>로그인할 때 쓰는 이메일이에요. 바꿀 수 없어요.</p>
        <div className={s.readonly}>{user.email}</div>
      </section>
      <NicknameForm key={user.nickname} current={user.nickname} />
      <PasswordForm />
    </>
  );
}
