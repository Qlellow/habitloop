import { useState, type FormEvent } from 'react';
import { useAuth, useTwoFactor } from '@loop/shared';
import { CodeField, useCooldown } from '../../components/CodeField';
import { toast } from '../../components/Toast';
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
  const cooldown = useCooldown();
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
        cooldown.start();
        toast(`${user?.email}(으)로 인증번호를 보냈어요`);
      },
      onError: (e) => toast(e.message),
    });
  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
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
          <p className={s.optionDesc}>메일로 받은 인증번호 6자리를 입력하면 2단계 인증이 켜져요. (10분 동안 유효)</p>
          <CodeField value={code} onChange={setCode} autoFocus />
          {enable.error && <p className={cn(ui.error, 'mb-0')}>{enable.error.message}</p>}
          <div className={s.inlineActions}>
            <button type="button" className={cn(ui.button, ui.text, ui.small)} disabled={cooldown.left > 0 || sendCode.isPending} onClick={requestCode}>
              {cooldown.left > 0 ? `다시 받기 (${cooldown.left}초)` : '번호 다시 받기'}
            </button>
            <span className="flex-1" />
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} onClick={reset}>
              취소
            </button>
            <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={code.length !== 6 || enable.isPending}>
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

export default function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>설정</h1>
        <p className={s.desc}>화면·글쓰기 설정은 바로 적용되고 이 브라우저에 저장돼요.</p>
      </div>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>보안</h2>
        <TwoFactorOption />
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
            <div className={s.optionDesc}>글쓰기 화면을 열 때 처음 보이는 방식이에요. (좁은 화면에서는 나란히 대신 작성)</div>
          </div>
          <Segment
            name="editorMode"
            value={settings.editorMode}
            options={[
              ['write', '작성'],
              ['split', '나란히'],
              ['preview', '미리보기'],
            ]}
          />
        </div>
      </section>
    </>
  );
}
