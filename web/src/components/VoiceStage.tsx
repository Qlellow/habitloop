import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, ExpandIcon, MicOffIcon, PictureInPictureIcon, RestoreIcon, ScreenShareIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { VoiceControlBar } from './VoiceControls';
import { callSince, useVoice, type VoicePerson, type VoiceScreen } from '../lib/voice';
import { canPopOut, closeVoiceWindow, openVoiceWindow, useVoiceWindow } from '../lib/voiceWindow';
import { cn } from '../lib/cn';

/**
 * 음성방 화면: 화면 공유를 크게 보고(여러 명이면 고르기), 참여자는 타일로(말하면 테두리가 빛남),
 * 아래에 마이크 · 듣기 끄기 · 화면 공유 · 설정 · 통화 끊기. 위에는 방 이름과 통화 시간.
 * 새 창(Document PiP)이나 사이트 안 창에 그린다 (lib/voiceWindow).
 */

/** 통화 시간 (1초마다): 1:05 · 1:02:03 */
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function CallTimer({ since, className }: { since?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  return (
    <span className={cn('voice-timer', className)} title="통화 시간 (지금 있는 사람 중 가장 먼저 들어온 때부터)">
      {formatDuration(now - since)}
    </span>
  );
}

function ScreenVideo({ screen }: { screen: VoiceScreen }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    screen.track.attach(el);
    return () => void screen.track.detach(el);
  }, [screen.track]);
  return <video ref={ref} className="voice-stage-video" autoPlay playsInline muted />;
}

function Tile({ p, small }: { p: VoicePerson; small?: boolean }) {
  return (
    <div className={cn('voice-tile', p.speaking && !p.muted && 'is-speaking', small && 'is-small')}>
      <span className="voice-tile-avatar">
        <UserAvatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={small ? 36 : 64} />
      </span>
      <span className="voice-tile-name">
        {p.muted && <MicOffIcon width={13} height={13} className="flex-none text-danger" aria-label="마이크 꺼짐" />}
        <span className="truncate">
          {p.nickname}
          {p.local && ' (나)'}
        </span>
        {p.sharing && (
          <span className="voice-live">
            <ScreenShareIcon width={10} height={10} /> 라이브
          </span>
        )}
      </span>
    </div>
  );
}

export function VoiceStage({
  popped,
  onPopOut,
  onClose,
  headProps,
  tools,
}: {
  popped: boolean;
  onPopOut?: () => void;
  onClose: () => void;
  /** 사이트 안 창: 위쪽 줄로 끌기 · 두 번 눌러 최대화 */
  headProps?: HTMLAttributes<HTMLDivElement>;
  /** 위쪽 줄 오른쪽에 더 둘 버튼 (최대화) */
  tools?: ReactNode;
}) {
  const v = useVoice();
  const [pick, setPick] = useState<string>();
  if (!v.join) return null;
  // 다른 사람의 화면을 먼저, 내 화면은 나만 볼 수 있게 맨 뒤에
  const screens = [...v.screens.filter((s) => !s.local), ...v.screens.filter((s) => s.local)];
  const cur = screens.find((s) => s.id === pick) ?? screens[0];
  const since = callSince(v.people);
  return (
    <div className="voice-stage" data-fx-off="">
      <div className="voice-stage-head" {...headProps}>
        <span className={cn('voice-dot', v.status !== 'connected' && 'is-wait')} aria-hidden />
        <b className="truncate">{v.join.room.name}</b>
        <CallTimer since={since} />
        <span className="truncate text-fg-weak font-normal">· {v.join.channel.name}</span>
        <span className="ml-auto flex items-center gap-1">
          {onPopOut && (
            <button type="button" className="voice-stage-btn" onClick={onPopOut} title="새 창으로 띄우기 (다른 모니터로 옮길 수 있어요)" aria-label="새 창으로 띄우기">
              <PictureInPictureIcon width={16} height={16} />
            </button>
          )}
          {tools}
          {!popped && (
            <button type="button" className="voice-stage-btn" onClick={onClose} title="방 화면 닫기 (통화는 이어져요)" aria-label="방 화면 닫기">
              <CloseIcon width={16} height={16} />
            </button>
          )}
        </span>
      </div>

      <div className={cn('voice-stage-body', cur && 'has-screen')}>
        {cur ? (
          <>
            <div className="voice-stage-main">
              {screens.length > 1 && (
                <div className="voice-stage-tabs" role="tablist" aria-label="공유 중인 화면">
                  {screens.map((s) => (
                    <button key={s.id} type="button" role="tab" aria-selected={s.id === cur.id} onClick={() => setPick(s.id)}>
                      {s.local ? '내 화면' : `${s.nickname}님`}
                    </button>
                  ))}
                </div>
              )}
              <div className="voice-stage-screen">
                <ScreenVideo key={cur.id} screen={cur} />
                <span className="voice-stage-caption">
                  <span className="voice-live">라이브</span> {cur.local ? '내 화면 (다른 사람에게 보이는 모습)' : `${cur.nickname}님의 화면`}
                </span>
              </div>
            </div>
            <div className="voice-stage-strip">
              {v.people.map((p) => (
                <Tile key={p.id} p={p} small />
              ))}
            </div>
          </>
        ) : (
          <div className="voice-stage-grid">
            {v.people.map((p) => (
              <Tile key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      <div className="voice-stage-foot">
        <VoiceControlBar inStage />
      </div>
    </div>
  );
}

/** 사이트 안 창: 위쪽 줄을 끌어 옮기고, 오른쪽 아래를 끌어 크기를 바꾸고, 최대화 */
function InlineWindow() {
  const [box, setBox] = useState(() => {
    const w = Math.min(920, window.innerWidth - 32);
    const h = Math.min(600, window.innerHeight - 120);
    return { x: Math.max(16, (window.innerWidth - w) / 2), y: Math.max(80, (window.innerHeight - h) / 2), w, h };
  });
  const [max, setMax] = useState(false);
  const drag = useRef<{ mode: 'move' | 'size'; sx: number; sy: number; box: typeof box } | undefined>(undefined);

  const down = (mode: 'move' | 'size') => (e: ReactPointerEvent) => {
    if (e.button !== 0 || max) return;
    if (mode === 'move' && (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      setBox({ ...d.box, x: Math.max(-d.box.w + 120, Math.min(window.innerWidth - 120, d.box.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 48, d.box.y + dy)) });
    } else {
      setBox({ ...d.box, w: Math.max(420, Math.min(window.innerWidth - d.box.x - 8, d.box.w + dx)), h: Math.max(320, Math.min(window.innerHeight - d.box.y - 8, d.box.h + dy)) });
    }
  };
  const up = () => (drag.current = undefined);

  return (
    <div
      className={cn('voice-window', max && 'is-max')}
      style={max ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h }}
      role="dialog"
      aria-label="음성방"
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <VoiceStage
        popped={false}
        onPopOut={canPopOut() ? () => openVoiceWindow(true) : undefined}
        onClose={closeVoiceWindow}
        headProps={{
          className: cn('voice-stage-head', !max && 'is-draggable'),
          onPointerDown: down('move'),
          onDoubleClick: (e) => !(e.target as HTMLElement).closest('button') && setMax((m) => !m),
        }}
        tools={
          <button type="button" className="voice-stage-btn" onClick={() => setMax((m) => !m)} aria-label={max ? '창 크기로' : '최대화'} title={max ? '창 크기로' : '최대화'}>
            {max ? <RestoreIcon width={15} height={15} /> : <ExpandIcon width={15} height={15} />}
          </button>
        }
      />
      {!max && <span className="voice-window-resize" onPointerDown={down('size')} aria-hidden />}
    </div>
  );
}

/** 열린 방 화면을 알맞은 곳에 그린다 (App 에 한 번) */
export function VoiceWindowHost() {
  const v = useVoice();
  const { mode, pip } = useVoiceWindow();
  // 통화가 끝나면 창은 lib/voiceWindow 가 닫는다
  if (v.status === 'idle' || mode === 'closed') return null;
  if (mode === 'pip' && pip) return createPortal(<VoiceStage popped onClose={closeVoiceWindow} />, pip.document.body);
  return <InlineWindow />;
}
