import { useEffect, useState, type ReactNode } from 'react';
import { GearIcon, HeadphonesIcon, HeadphonesOffIcon, LeaveCallIcon, MicIcon, MicOffIcon, ScreenShareIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { toast } from './Toast';
import { canShareScreen, getPrefs, useVoice, voice, type VoicePerson } from '../lib/voice';
import { cn } from '../lib/cn';

/**
 * 음성채팅 조작 (음성 떠 있는 버튼의 창 · 채널 화면의 음성 채팅 카드가 함께 쓴다):
 * 마이크 · 듣기 끄기 · 화면 공유 · 설정 · 나가기, 설정 칸(마이크 · 스피커 · 잡음 제거), 참여자 사진.
 */

export const runVoice = (p: Promise<unknown>) => p.catch((e: Error) => toast(e.message));

function Ctl({ on, danger, label, onClick, children, pressed }: { on?: boolean; danger?: boolean; label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button type="button" className={cn('voice-ctl', on === false && 'is-off', danger && 'is-danger')} aria-label={label} aria-pressed={pressed} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

/** 참여자 사진: 말하면 테두리가 빛나고, 마이크를 끄면 빨간 표시 */
export function VoiceAvatar({ p, size = 30 }: { p: VoicePerson; size?: number }) {
  return (
    <span className={cn('voice-avatar', p.speaking && !p.muted && 'is-speaking')} title={`${p.nickname}${p.muted ? ' (마이크 꺼짐)' : ''}`}>
      <UserAvatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={size} />
      {p.muted && (
        <span className="voice-avatar-badge" aria-hidden>
          <MicOffIcon width={10} height={10} />
        </span>
      )}
    </span>
  );
}

function DeviceSelect({ kind, label }: { kind: 'audioinput' | 'audiooutput'; label: string }) {
  const [list, setList] = useState<MediaDeviceInfo[]>([]);
  const [value, setValue] = useState(() => (kind === 'audioinput' ? getPrefs().micDevice : getPrefs().speakerDevice) ?? '');
  useEffect(() => {
    void voice.devices(kind).then(setList, () => setList([]));
  }, [kind]);
  // 스피커 고르기는 지원하지 않는 브라우저가 있다 (사파리 · 파이어폭스 일부)
  if (kind === 'audiooutput' && list.length === 0) return null;
  return (
    <label className="grid gap-1 min-w-0 text-[12px] font-semibold text-fg-sub">
      {label}
      <select
        className="w-full min-w-0 h-8 px-2 rounded-sm border border-border bg-surface text-[13px] font-normal text-fg truncate"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          void runVoice(voice.setDevice(kind, e.target.value));
        }}
      >
        <option value="">기본 장치</option>
        {list.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || (kind === 'audioinput' ? '마이크' : '스피커')}
          </option>
        ))}
      </select>
    </label>
  );
}

function VoiceSettings() {
  const v = useVoice();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 min-w-0 p-2.5 rounded-md bg-field">
      <DeviceSelect kind="audioinput" label="마이크" />
      <DeviceSelect kind="audiooutput" label="스피커" />
      <label className="flex items-center justify-between gap-2 text-[12px] font-semibold text-fg-sub">
        잡음 제거
        <button
          type="button"
          role="switch"
          aria-checked={v.noiseSuppression}
          aria-label="잡음 제거"
          className="home-mini-switch"
          onClick={() => void runVoice(voice.setNoiseSuppression(!v.noiseSuppression))}
        />
      </label>
      <p className="m-0 text-[11px] text-fg-weak">Ctrl+Shift+M 마이크 · Ctrl+Shift+D 듣기</p>
    </div>
  );
}

/** 마이크 · 듣기 끄기 · 화면 공유 · 설정 · 나가기 (+ 설정 칸, 상태 안내) */
export function VoiceControlBar() {
  const v = useVoice();
  const [settings, setSettings] = useState(false);
  return (
    // 좁은 카드에서도 넘치지 않게: 칸은 부모 폭을 넘지 않고(min-w-0), 긴 장치 이름은 말줄임
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 min-w-0">
      {settings && <VoiceSettings />}
      <div className="flex items-center gap-1.5 min-w-0">
        <Ctl on={v.micOn} pressed={!v.micOn} label={v.micOn ? '마이크 끄기 (Ctrl+Shift+M)' : '마이크 켜기 (Ctrl+Shift+M)'} onClick={() => void runVoice(voice.toggleMic())}>
          {v.micOn ? <MicIcon /> : <MicOffIcon />}
        </Ctl>
        <Ctl on={!v.deafened} pressed={v.deafened} label={v.deafened ? '듣기 켜기 (Ctrl+Shift+D)' : '듣기 끄기 (Ctrl+Shift+D)'} onClick={() => void runVoice(voice.setDeafened(!v.deafened))}>
          {v.deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
        </Ctl>
        {canShareScreen() && (
          <Ctl pressed={v.sharing} label={v.sharing ? '화면 공유 멈추기' : '화면 공유'} onClick={() => void runVoice(voice.toggleScreen())}>
            <ScreenShareIcon className={v.sharing ? 'text-primary' : undefined} />
          </Ctl>
        )}
        <Ctl pressed={settings} label="음성 설정" onClick={() => setSettings((s) => !s)}>
          <GearIcon />
        </Ctl>
        <Ctl danger label="통화 끊기" onClick={() => void runVoice(voice.leave())}>
          <LeaveCallIcon />
        </Ctl>
      </div>
      {v.audioBlocked && (
        <button type="button" className="voice-unblock" onClick={() => void runVoice(voice.startAudio())}>
          🔈 브라우저가 소리를 막았어요 · 눌러서 소리 켜기
        </button>
      )}
      {v.listenOnly && <p className="m-0 text-[11px] text-fg-weak">마이크를 쓸 수 없어 듣기만 하는 중이에요</p>}
      {v.sharing && <p className="m-0 text-[11px] font-semibold text-danger">내 화면을 공유하고 있어요</p>}
    </div>
  );
}
