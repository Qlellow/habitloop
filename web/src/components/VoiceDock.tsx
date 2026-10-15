import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMyBlocks, voiceKey } from '@loop/shared';
import { ExpandIcon, GearIcon, HeadphonesIcon, HeadphonesOffIcon, LeaveCallIcon, MicIcon, MicOffIcon, MinimizeIcon, ScreenShareIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { toast } from './Toast';
import { canShareScreen, getPrefs, useVoice, voice, type VoicePerson, type VoiceScreen } from '../lib/voice';
import { cn } from '../lib/cn';

/**
 * 음성채팅 막대: 음성방에 들어가 있는 동안 화면 왼쪽 아래에 떠 있다 (화면을 옮겨도 이어진다).
 *  - 마이크 (Ctrl+Shift+M) · 듣기 끄기 (Ctrl+Shift+D) · 화면 공유 · 설정(마이크 · 스피커 · 잡음 제거) · 나가기
 *  - 말하는 사람은 사진 테두리가 빛나고, 사람마다 내게 들리는 볼륨을 정할 수 있다
 *  - 누가 화면을 공유하면 화면 보기 창이 뜬다
 */

const run = (p: Promise<unknown>) => p.catch((e: Error) => toast(e.message));

function Ctl({ on, danger, label, onClick, children, pressed }: { on?: boolean; danger?: boolean; label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button type="button" className={cn('voice-ctl', on === false && 'is-off', danger && 'is-danger')} aria-label={label} aria-pressed={pressed} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function Person({ p, compact }: { p: VoicePerson; compact?: boolean }) {
  return (
    <span className={cn('voice-avatar', p.speaking && !p.muted && 'is-speaking')} title={`${p.nickname}${p.muted ? ' (마이크 꺼짐)' : ''}`}>
      <UserAvatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={compact ? 26 : 30} />
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
    <label className="grid gap-1 text-[12px] font-semibold text-fg-sub">
      {label}
      <select
        className="h-8 px-2 rounded-sm border border-border bg-surface text-[13px] font-normal text-fg"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          void run(voice.setDevice(kind, e.target.value));
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

/** 화면 공유 보기 창 */
function ScreenViewer({ screens }: { screens: VoiceScreen[] }) {
  const remote = screens.filter((s) => !s.local);
  const [pick, setPick] = useState<string>();
  const [hidden, setHidden] = useState<string[]>([]);
  const [big, setBig] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const visible = remote.filter((s) => !hidden.includes(s.id));
  const cur = visible.find((s) => s.id === pick) ?? visible[0];

  // 새로 공유를 시작한 사람은 다시 보이게
  const ids = remote.map((s) => s.id).join(',');
  useEffect(() => setHidden((h) => h.filter((id) => ids.split(',').includes(id))), [ids]);

  useEffect(() => {
    const el = video.current;
    if (!el || !cur) return;
    cur.track.attach(el);
    return () => void cur.track.detach(el);
  }, [cur]);

  if (!cur) return null;
  return (
    <div ref={box} className={cn('voice-screen', big && 'is-big')} role="region" aria-label={`${cur.nickname}님의 화면`}>
      <div className="voice-screen-head">
        <span className="voice-live">라이브</span>
        {visible.length > 1 ? (
          <span className="flex gap-1 min-w-0 overflow-x-auto">
            {visible.map((s) => (
              <button key={s.id} type="button" className={cn('voice-screen-tab', s.id === cur.id && 'is-on')} onClick={() => setPick(s.id)}>
                {s.nickname}
              </button>
            ))}
          </span>
        ) : (
          <b className="truncate text-[13px]">{cur.nickname}님의 화면</b>
        )}
        <span className="ml-auto flex gap-0.5">
          <button type="button" aria-label="전체 화면" title="전체 화면" onClick={() => void box.current?.requestFullscreen?.().catch(() => undefined)}>
            ⛶
          </button>
          <button type="button" aria-label={big ? '작게 보기' : '크게 보기'} title={big ? '작게 보기' : '크게 보기'} onClick={() => setBig((b) => !b)}>
            {big ? <MinimizeIcon width={15} height={15} /> : <ExpandIcon width={15} height={15} />}
          </button>
          <button type="button" aria-label="화면 닫기" title="닫기 (다시 공유하면 또 떠요)" onClick={() => setHidden((h) => [...h, cur.id])}>
            ✕
          </button>
        </span>
      </div>
      <video ref={video} className="voice-screen-video" autoPlay playsInline muted />
    </div>
  );
}

function BlockSync() {
  const { data } = useMyBlocks();
  useEffect(() => voice.setBlocked(data?.map((b) => b.id) ?? []), [data]);
  return null;
}

export function VoiceDock() {
  const v = useVoice();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const slug = v.join?.channel.slug;

  // 들어오고 나가는 사람이 바뀌면 채널 화면의 방 목록도 새로
  const count = v.people.length;
  useEffect(() => {
    if (slug) void qc.invalidateQueries({ queryKey: voiceKey(slug) });
  }, [slug, count, v.status, qc]);

  // 단축키: Ctrl+Shift+M 마이크 · Ctrl+Shift+D 듣기
  useEffect(() => {
    if (v.status === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') {
        e.preventDefault();
        void run(voice.toggleMic());
      } else if (k === 'd') {
        e.preventDefault();
        void run(voice.setDeafened(!voice.get().deafened));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [v.status]);

  // 창을 닫으면 방에서 나간다 (다른 사람 목록에 남지 않게)
  useEffect(() => {
    if (v.status === 'idle') return;
    const bye = () => void voice.leave();
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [v.status]);

  if (v.status === 'idle' || !v.join) return null;
  const shown = v.people.slice(0, 7);
  const statusText = v.status === 'connecting' ? '연결 중…' : v.status === 'reconnecting' ? '다시 연결 중…' : '음성 연결됨';

  return (
    <>
      <BlockSync />
      <ScreenViewer screens={v.screens} />
      <div className="voice-dock" role="region" aria-label="음성채팅" data-fx-off="">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('voice-dot', v.status !== 'connected' && 'is-wait')} aria-hidden />
          <div className="flex-1 min-w-0">
            <div className={cn('text-[12px] font-bold', v.status === 'connected' ? 'text-[#03b26c]' : 'text-fg-weak')}>{statusText}</div>
            <Link to={`/c/${v.join.channel.slug}`} className="block truncate text-[13px] font-semibold text-fg-strong hover:underline underline-offset-2">
              {v.join.room.name} <span className="font-normal text-fg-weak">· {v.join.channel.name}</span>
            </Link>
          </div>
          <Ctl danger label="나가기" onClick={() => void run(voice.leave())}>
            <LeaveCallIcon />
          </Ctl>
        </div>

        <button type="button" className="voice-people" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`들어와 있는 사람 ${v.people.length}명 ${open ? '접기' : '펼치기'}`}>
          {shown.map((p) => (
            <Person key={p.id} p={p} compact />
          ))}
          {v.people.length > shown.length && <span className="text-[12px] text-fg-weak">+{v.people.length - shown.length}</span>}
          <span className="ml-auto text-[12px] text-fg-weak">{v.people.length}명</span>
        </button>

        {open && (
          <ul className="voice-list">
            {v.people.map((p) => (
              <li key={p.id}>
                <Person p={p} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-fg-strong">
                    {p.nickname}
                    {p.local && <span className="font-normal text-fg-weak"> (나)</span>}
                    {p.sharing && <span className="voice-live ml-1">라이브</span>}
                  </span>
                  {!p.local && (
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(p.volume * 100)}
                      aria-label={`${p.nickname} 볼륨`}
                      className="voice-range"
                      onChange={(e) => void voice.setVolume(p.id, Number(e.target.value) / 100)}
                    />
                  )}
                </span>
                {!p.local && <span className="w-9 text-right text-[11px] text-fg-weak tabular-nums">{Math.round(p.volume * 100)}%</span>}
              </li>
            ))}
          </ul>
        )}

        {settings && (
          <div className="grid gap-2.5 p-2.5 rounded-md bg-field">
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
                onClick={() => void run(voice.setNoiseSuppression(!v.noiseSuppression))}
              />
            </label>
            <p className="m-0 text-[11px] text-fg-weak">Ctrl+Shift+M 마이크 · Ctrl+Shift+D 듣기</p>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Ctl on={v.micOn} pressed={!v.micOn} label={v.micOn ? '마이크 끄기 (Ctrl+Shift+M)' : '마이크 켜기 (Ctrl+Shift+M)'} onClick={() => void run(voice.toggleMic())}>
            {v.micOn ? <MicIcon /> : <MicOffIcon />}
          </Ctl>
          <Ctl on={!v.deafened} pressed={v.deafened} label={v.deafened ? '듣기 켜기 (Ctrl+Shift+D)' : '듣기 끄기 (Ctrl+Shift+D)'} onClick={() => void run(voice.setDeafened(!v.deafened))}>
            {v.deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
          </Ctl>
          {canShareScreen() && (
            <Ctl pressed={v.sharing} label={v.sharing ? '화면 공유 멈추기' : '화면 공유'} onClick={() => void run(voice.toggleScreen())}>
              <ScreenShareIcon className={v.sharing ? 'text-primary' : undefined} />
            </Ctl>
          )}
          <Ctl pressed={settings} label="음성 설정" onClick={() => setSettings((s) => !s)}>
            <GearIcon />
          </Ctl>
        </div>
        {v.listenOnly && <p className="m-0 text-[11px] text-fg-weak">마이크를 쓸 수 없어 듣기만 하는 중이에요</p>}
        {v.sharing && <p className="m-0 text-[11px] font-semibold text-danger">내 화면을 공유하고 있어요</p>}
      </div>
    </>
  );
}
