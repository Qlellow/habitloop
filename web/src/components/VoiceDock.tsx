import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useMyBlocks, voiceKey } from '@loop/shared';
import { toast } from './Toast';
import { ExpandIcon, HeadphonesOffIcon, MicIcon, MicOffIcon, MinimizeIcon } from './Icons';
import { VoiceAvatar, VoiceControlBar, runVoice } from './VoiceControls';
import { rememberRoom, useVoice, voice, type VoiceScreen } from '../lib/voice';
import { useVoiceWindow } from '../lib/voiceWindow';
import { VoiceWindowHost } from './VoiceStage';
import { cn } from '../lib/cn';
import '../styles/voice.css';

/**
 * 음성채팅 떠 있는 버튼 (FAB): 음성방에 들어가 있는 동안 화면 위에 떠 있고, 끌어서 원하는 곳에 둔다 (이 브라우저에 기억).
 * 누르면 통화 창이 펼쳐진다: 방 · 참여자(사람별 볼륨) · 마이크 · 듣기 끄기 · 화면 공유 · 설정 · 통화 끊기.
 * 버튼만 봐도 상태를 알 수 있다: 초록 테두리(연결) · 내가 말하면 빛남 · 마이크 꺼짐 · 듣기 꺼짐 · 사람 수.
 * 누가 화면을 공유하면 화면 보기 창이 뜬다. 화면을 옮겨도 연결은 이어진다.
 */

const FAB = 56;
const PANEL_W = 300;
const POS_KEY = 'loop.voice.fab';
/** 이만큼 움직여야 끌기로 본다 (그보다 적으면 누르기) */
const DRAG_SLOP = 5;

interface Pos {
  x: number;
  y: number;
}

/** 화면 안으로 (헤더 아래 · 폰 하단 탭바 위) */
function clampPos(p: Pos): Pos {
  const bottom = window.innerWidth <= 520 ? 72 : 12;
  return {
    x: Math.max(8, Math.min(window.innerWidth - FAB - 8, p.x)),
    y: Math.max(72, Math.min(window.innerHeight - FAB - bottom, p.y)),
  };
}

function loadPos(): Pos {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Pos | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clampPos(saved);
  } catch {
    // 처음 자리로
  }
  return clampPos({ x: 20, y: window.innerHeight });
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

  // 공유를 멈춘 사람은 숨김 목록에서 뺀다 (다시 공유하면 또 보이게)
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

/** 통화 창 (FAB 를 누르면 펼쳐진다) */
function VoicePanel({ pos, onClose }: { pos: Pos; onClose: () => void }) {
  const v = useVoice();
  const [list, setList] = useState(false);
  if (!v.join) return null;
  const shown = v.people.slice(0, 5);
  const statusText = v.status === 'connecting' ? '연결 중…' : v.status === 'reconnecting' ? '다시 연결 중…' : '음성 연결됨';
  // FAB 가 화면 왼쪽이면 오른쪽으로, 아래쪽이면 위로 펼친다
  const left = pos.x + FAB / 2 < window.innerWidth / 2 ? pos.x : pos.x + FAB - PANEL_W;
  const above = pos.y + FAB / 2 > window.innerHeight / 2;
  const style = above
    ? { left: Math.max(8, left), bottom: window.innerHeight - pos.y + 10, maxHeight: pos.y - 80 }
    : { left: Math.max(8, left), top: pos.y + FAB + 10, maxHeight: window.innerHeight - pos.y - FAB - 24 };
  return (
    <div className={cn('voice-panel', above ? 'is-above' : 'is-below')} style={style} role="dialog" aria-label="음성 통화" data-fx-off="">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('voice-dot', v.status !== 'connected' && 'is-wait')} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className={cn('text-[12px] font-bold', v.status === 'connected' ? 'text-[#03b26c]' : 'text-fg-weak')}>{statusText}</div>
          <Link to={`/c/${v.join.channel.slug}`} className="block truncate text-[13px] font-semibold text-fg-strong hover:underline underline-offset-2">
            {v.join.room.name} <span className="font-normal text-fg-weak">· {v.join.channel.name}</span>
          </Link>
        </div>
        <button type="button" className="grid place-items-center w-7 h-7 rounded-md text-fg-sub hover:bg-field" aria-label="통화 창 접기" title="접기" onClick={onClose}>
          <MinimizeIcon width={15} height={15} />
        </button>
      </div>

      <button type="button" className="voice-people" onClick={() => setList((o) => !o)} aria-expanded={list} aria-label={`들어와 있는 사람 ${v.people.length}명 ${list ? '접기' : '펼치기'}`}>
        {shown.map((p) => (
          <VoiceAvatar key={p.id} p={p} size={26} />
        ))}
        {v.people.length > shown.length && <span className="text-[12px] text-fg-weak whitespace-nowrap">+{v.people.length - shown.length}</span>}
        <span className="ml-auto text-[12px] text-fg-weak whitespace-nowrap">
          {v.people.length}명 {list ? '▴' : '▾'}
        </span>
      </button>

      {list && (
        <ul className="voice-list">
          {v.people.map((p) => (
            <li key={p.id}>
              <VoiceAvatar p={p} />
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

      <VoiceControlBar />
    </div>
  );
}

export function VoiceDock() {
  const v = useVoice();
  const win = useVoiceWindow();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(loadPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | undefined>(undefined);
  const slug = v.join?.channel.slug;
  const me = v.people.find((p) => p.local);

  // 들어오고 나가는 사람이 바뀌면 채널 화면의 방 목록도 새로
  const count = v.people.length;
  useEffect(() => {
    if (slug) void qc.invalidateQueries({ queryKey: voiceKey(slug) });
  }, [slug, count, v.status, qc]);

  // 새로고침 전에 들어가 있던 방으로 다시 들어간다 (로그인 확인이 끝난 뒤 한 번)
  const { isLoggedIn, ready } = useAuth();
  const resumed = useRef(false);
  useEffect(() => {
    if (!ready || resumed.current) return;
    resumed.current = true;
    if (!isLoggedIn) return rememberRoom(undefined);
    void voice.resume().then((ok) => ok && toast('음성방에 다시 들어왔어요'));
  }, [ready, isLoggedIn]);

  // 브라우저가 소리를 막았으면 화면을 아무 곳이나 한 번 누르는 순간 푼다
  useEffect(() => {
    if (!v.audioBlocked) return;
    const unlock = () => void voice.startAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [v.audioBlocked]);

  // 방에서 나오면 창도 접는다
  useEffect(() => {
    if (v.status === 'idle') setOpen(false);
  }, [v.status]);

  // 창 크기가 바뀌면 화면 안으로
  useLayoutEffect(() => {
    const fit = () => setPos((p) => clampPos(p));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // 단축키: Ctrl+Shift+M 마이크 · Ctrl+Shift+D 듣기 · Esc 창 접기
  useEffect(() => {
    if (v.status === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false);
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') {
        e.preventDefault();
        void runVoice(voice.toggleMic());
      } else if (k === 'd') {
        e.preventDefault();
        void runVoice(voice.setDeafened(!voice.get().deafened));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [v.status]);

  // 창을 닫으면 방에서 나간다 (다른 사람 목록에 남지 않게)
  useEffect(() => {
    if (v.status === 'idle') return;
    // 새로고침 · 창 닫기: 연결은 끊되 이 탭에 방을 기억해 다시 열면 그 방으로 들어간다
    const bye = () => void voice.leave({ keepResume: true });
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [v.status]);

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_SLOP) return;
    if (!d.moved) setDragging(true);
    d.moved = true;
    setPos(clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const onUp = useCallback(() => {
    const d = drag.current;
    drag.current = undefined;
    if (!d) return;
    if (!d.moved) return setOpen((o) => !o);
    setDragging(false);
    // 놓으면 가까운 옆 가장자리로 붙는다
    setPos((p) => {
      const next = clampPos({ x: p.x + FAB / 2 < window.innerWidth / 2 ? 16 : window.innerWidth - FAB - 16, y: p.y });
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {
        // 저장소를 못 쓰면 이번 방문에만
      }
      return next;
    });
  }, []);

  if (v.status === 'idle' || !v.join) return null;
  const waiting = v.status !== 'connected';
  const label = `음성 통화 · ${v.join.room.name} (${v.people.length}명). 누르면 ${open ? '접기' : '펼치기'}, 끌어서 옮기기`;

  return (
    <>
      <BlockSync />
      {/* 방 화면을 열었으면 화면 공유는 거기서 크게 본다 */}
      {win.mode === 'closed' && <ScreenViewer screens={v.screens} />}
      <VoiceWindowHost />
      {open && <VoicePanel pos={pos} onClose={() => setOpen(false)} />}
      <button
        type="button"
        className={cn('voice-fab', !v.micOn && 'is-muted', waiting && 'is-wait', dragging && 'is-dragging', open && 'is-open', me?.speaking && v.micOn && 'is-speaking')}
        style={{ left: pos.x, top: pos.y }}
        aria-label={label}
        aria-expanded={open}
        title={dragging ? undefined : `${v.join.room.name} · ${v.join.channel.name}`}
        data-fx-off=""
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={(e) => {
          // 키보드로 누르면 펼치기 (pointer 이벤트 없이)
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        {v.deafened ? <HeadphonesOffIcon /> : v.micOn ? <MicIcon /> : <MicOffIcon />}
        <span className="voice-fab-count" aria-hidden>
          {v.people.length}
        </span>
        {v.sharing && (
          <span className="voice-fab-live" aria-hidden>
            LIVE
          </span>
        )}
        {v.audioBlocked && (
          <span className="voice-fab-hint" aria-hidden>
            눌러서 소리 켜기
          </span>
        )}
      </button>
    </>
  );
}
