import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoTrack,
} from 'livekit-client';
import { fetchVoiceToken, type VoiceJoin } from '@loop/shared';
import { getBlocked, getPrefs, idleState, rememberRoom, savePrefs, setVoiceState, voice, type VoicePerson, type VoiceScreen } from './voice';

/**
 * 음성채팅 엔진 (LiveKit). lib/voice.ts 가 처음 방에 들어갈 때 불러온다.
 * 들어가기 · 나오기, 마이크 · 듣기 · 화면 공유, 사람별 볼륨, 말하는 사람 표시.
 */

let room: Room | undefined;
let speaking = new Set<string>();
/** 원격 음성을 내는 audio 요소들 */
const audioEls = new Map<string, HTMLMediaElement>();

type SinkEl = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

const meta = (p: Participant) => {
  try {
    return JSON.parse(p.metadata || '{}') as { avatarUrl?: string };
  } catch {
    return {};
  }
};

const volumeOf = (id: string) => (getBlocked().includes(id) || voice.get().deafened ? 0 : (getPrefs().volumes[id] ?? 1));

function applyVolume(p: RemoteParticipant) {
  const v = volumeOf(p.identity);
  p.setVolume(v, Track.Source.Microphone);
  p.setVolume(v, Track.Source.ScreenShareAudio);
}

export const applyBlocked = () => room?.remoteParticipants.forEach(applyVolume);

/** 방 안 사람 · 화면 공유를 다시 모은다 */
function sync() {
  if (!room) return;
  const local = room.localParticipant;
  // 새로고침 직후엔 끊기 전의 내 연결이 잠깐 남아 있을 수 있다: 내 것과 같은 계정은 빼고 보여 준다
  const all: Participant[] = [local, ...[...room.remoteParticipants.values()].filter((p) => p.identity !== local.identity)];
  const people = all.map((p): VoicePerson => {
    const mic = p.getTrackPublication(Track.Source.Microphone);
    return {
      id: p.identity,
      nickname: p.name || '알 수 없음',
      avatarUrl: meta(p).avatarUrl,
      local: p === local,
      speaking: speaking.has(p.identity),
      muted: !mic || mic.isMuted,
      sharing: !!p.getTrackPublication(Track.Source.ScreenShare)?.track,
      volume: getPrefs().volumes[p.identity] ?? 1,
    };
  });
  const screens: VoiceScreen[] = [];
  for (const p of all) {
    const track = p.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (track?.kind === Track.Kind.Video) screens.push({ id: p.identity, nickname: p.name || '알 수 없음', local: p === local, track: track as VideoTrack });
  }
  setVoiceState({ people, screens, micOn: local.isMicrophoneEnabled, sharing: local.isScreenShareEnabled });
}

function attachAudio(track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) {
  if (track.kind !== Track.Kind.Audio) return;
  const el = track.attach() as SinkEl;
  el.dataset.voice = p.identity;
  el.style.display = 'none';
  document.body.appendChild(el);
  audioEls.set(pub.trackSid, el);
  const sink = getPrefs().speakerDevice;
  if (sink && el.setSinkId) el.setSinkId(sink).catch(() => undefined);
  applyVolume(p);
}

function detachAudio(track: RemoteTrack, pub: RemoteTrackPublication) {
  track.detach().forEach((el) => el.remove());
  audioEls.get(pub.trackSid)?.remove();
  audioEls.delete(pub.trackSid);
}

function cleanup() {
  audioEls.forEach((el) => el.remove());
  audioEls.clear();
  speaking = new Set();
  room = undefined;
}

export async function join(roomId: number) {
  const now = voice.get();
  if (now.join?.room.id === roomId && now.status !== 'idle') return;
  if (room) await leave();
  setVoiceState({ ...idleState(), status: 'connecting' });
  let info: VoiceJoin;
  try {
    info = await fetchVoiceToken(roomId);
  } catch (e) {
    setVoiceState(idleState());
    throw e;
  }
  const prefs = getPrefs();
  const r = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: { noiseSuppression: prefs.noiseSuppression, echoCancellation: true, autoGainControl: true, deviceId: prefs.micDevice },
    audioOutput: prefs.speakerDevice ? { deviceId: prefs.speakerDevice } : undefined,
  });
  room = r;
  r.on(RoomEvent.ParticipantConnected, (p) => {
    applyVolume(p);
    sync();
  })
    .on(RoomEvent.ParticipantDisconnected, sync)
    .on(RoomEvent.TrackSubscribed, (track, pub, p) => {
      attachAudio(track, pub, p);
      sync();
    })
    .on(RoomEvent.TrackUnsubscribed, (track, pub) => {
      detachAudio(track, pub);
      sync();
    })
    .on(RoomEvent.TrackMuted, sync)
    .on(RoomEvent.TrackUnmuted, sync)
    .on(RoomEvent.TrackPublished, sync)
    .on(RoomEvent.TrackUnpublished, sync)
    .on(RoomEvent.LocalTrackPublished, sync)
    .on(RoomEvent.LocalTrackUnpublished, sync)
    .on(RoomEvent.ParticipantNameChanged, sync)
    .on(RoomEvent.ActiveSpeakersChanged, (list) => {
      speaking = new Set(list.map((p) => p.identity));
      sync();
    })
    .on(RoomEvent.ConnectionStateChanged, (s) => {
      if (room !== r) return;
      if (s === ConnectionState.Reconnecting) setVoiceState({ status: 'reconnecting' });
      if (s === ConnectionState.Connected) setVoiceState({ status: 'connected' });
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (room === r) setVoiceState({ audioBlocked: !r.canPlaybackAudio });
    })
    .on(RoomEvent.Disconnected, (reason) => {
      if (room !== r) return;
      // 서버가 끊었으면 (방이 지워짐 · 내보내짐 · 다른 창에서 같은 계정으로 들어옴) 새로고침해도 다시 들어가지 않게.
      // 페이지를 떠나며 스스로 끊은 건(CLIENT_INITIATED) 기억해 둔다 → 새로고침하면 다시 들어간다
      if (reason !== DisconnectReason.CLIENT_INITIATED) rememberRoom(undefined);
      cleanup();
      setVoiceState(idleState());
    });
  try {
    await r.connect(info.url, info.token);
  } catch {
    if (room === r) cleanup();
    setVoiceState(idleState());
    throw new Error('음성 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요');
  }
  setVoiceState({ status: 'connected', join: info });
  // 들어갈 때 마이크를 켠다. 권한이 없거나 마이크가 없으면 듣기만
  let listenOnly = false;
  try {
    await r.localParticipant.setMicrophoneEnabled(true);
  } catch {
    listenOnly = true;
  }
  await r.startAudio().catch(() => undefined);
  // 새로고침 뒤 자동으로 다시 들어오면 (누르지 않았으니) 브라우저가 소리를 막을 수 있다
  setVoiceState({ listenOnly, audioBlocked: !r.canPlaybackAudio });
  sync();
}

export async function startAudio() {
  if (!room) return;
  await room.startAudio().catch(() => undefined);
  setVoiceState({ audioBlocked: !room.canPlaybackAudio });
}

export async function leave() {
  const r = room;
  cleanup();
  setVoiceState(idleState());
  await r?.disconnect();
}

export async function toggleMic() {
  if (!room) return;
  const on = !room.localParticipant.isMicrophoneEnabled;
  try {
    await room.localParticipant.setMicrophoneEnabled(on);
    setVoiceState({ listenOnly: false });
    // 듣기를 끈 채로 말하려 하면 듣기도 켠다 (말하면서 못 듣는 상태는 없게)
    if (on && voice.get().deafened) {
      setVoiceState({ deafened: false });
      applyBlocked();
    }
  } catch {
    setVoiceState({ listenOnly: true });
    sync();
    throw new Error('마이크를 쓸 수 없어요. 브라우저의 마이크 권한을 확인해 주세요');
  }
  sync();
}

/** 듣기 끄기: 모든 소리를 끄고 마이크도 끈다. 다시 켜면 마이크도 켜진다 */
export async function setDeafened(on: boolean) {
  if (!room) return;
  setVoiceState({ deafened: on });
  applyBlocked();
  const local = room.localParticipant;
  if (on && local.isMicrophoneEnabled) await local.setMicrophoneEnabled(false);
  else if (!on && !voice.get().listenOnly && !local.isMicrophoneEnabled) await local.setMicrophoneEnabled(true).catch(() => undefined);
  sync();
}

export async function toggleScreen() {
  if (!room) return;
  const on = !room.localParticipant.isScreenShareEnabled;
  try {
    await room.localParticipant.setScreenShareEnabled(on, { audio: true, selfBrowserSurface: 'exclude', surfaceSwitching: 'include' });
  } catch (e) {
    // 고르기 창에서 취소하면 조용히
    if ((e as Error).name !== 'NotAllowedError') throw new Error('화면을 공유하지 못했어요');
  }
  sync();
}

/** 이 사람 볼륨 (내게만, 이 브라우저에 기억) */
export function setVolume(id: string, v: number) {
  savePrefs({ volumes: { ...getPrefs().volumes, [id]: Math.max(0, Math.min(1.5, v)) } });
  const p = room?.remoteParticipants.get(id);
  if (p) applyVolume(p);
  sync();
}

export async function setNoiseSuppression(on: boolean) {
  savePrefs({ noiseSuppression: on });
  setVoiceState({ noiseSuppression: on });
  // 마이크를 새 설정으로 다시 잡는다
  const local = room?.localParticipant;
  if (local?.isMicrophoneEnabled) {
    await local.setMicrophoneEnabled(false);
    await local.setMicrophoneEnabled(true, { noiseSuppression: on, echoCancellation: true, autoGainControl: true, deviceId: getPrefs().micDevice });
    sync();
  }
}

export const devices = (kind: MediaDeviceKind) => Room.getLocalDevices(kind, false);

export async function setDevice(kind: 'audioinput' | 'audiooutput', id: string) {
  savePrefs(kind === 'audioinput' ? { micDevice: id } : { speakerDevice: id });
  if (room) await room.switchActiveDevice(kind, id).catch(() => undefined);
  if (kind === 'audiooutput') audioEls.forEach((el) => (el as SinkEl).setSinkId?.(id).catch(() => undefined));
}
